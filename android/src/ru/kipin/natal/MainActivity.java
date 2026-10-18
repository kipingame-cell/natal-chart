package ru.kipin.natal;

import android.app.Activity;
import android.content.*;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.webkit.*;
import android.widget.FrameLayout;
import android.widget.Toast;
import java.io.*;
import java.util.*;

public final class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/index.html";
    private static final int SAVE_DOCUMENT = 41;
    private WebView web;
    private byte[] pendingFile;
    private boolean exporting;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        root.setBackgroundColor(Color.rgb(11,16,36));
        root.setOnApplyWindowInsetsListener((view, insets) -> {
            view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            return insets;
        });
        web = new WebView(this);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        web.setBackgroundColor(Color.rgb(11,16,36));
        web.setWebChromeClient(new WebChromeClient());
        web.addJavascriptInterface(new FilesBridge(), "AndroidBridge");
        web.setWebViewClient(new WebViewClient() {
            @Override public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (!"https".equals(u.getScheme()) || !HOST.equals(u.getHost())) return response(403,"Forbidden");
                String path = u.getPath();
                if (path == null || path.contains("..") || path.indexOf('\\') >= 0 || path.indexOf('\0') >= 0) return response(403,"Forbidden");
                if (path.equals("/")) path = "/index.html";
                try {
                    String mime = mime(path);
                    Map<String,String> headers = new HashMap<>();
                    headers.put("Cache-Control", "no-store");
                    headers.put("X-Content-Type-Options", "nosniff");
                    return new WebResourceResponse(mime, isText(mime) ? "UTF-8" : null, 200, "OK", headers,
                        getAssets().open("www" + path));
                } catch (IOException e) { return response(404,"Not Found"); }
            }
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if ("https".equals(uri.getScheme()) && HOST.equals(uri.getHost())) return false;
                if (request.isForMainFrame() && ("https".equals(uri.getScheme()) || "http".equals(uri.getScheme()))) {
                    try { startActivity(new Intent(Intent.ACTION_VIEW, uri)); }
                    catch (ActivityNotFoundException e) { message("Не найден браузер"); }
                }
                return true;
            }
        });
        web.loadUrl(START);
    }

    private static boolean isText(String mime) { return mime.startsWith("text/") || mime.contains("javascript") || mime.contains("json") || mime.contains("svg"); }
    private static String mime(String path) {
        if (path.endsWith(".js") || path.endsWith(".mjs")) return "text/javascript";
        if (path.endsWith(".css")) return "text/css";
        if (path.endsWith(".html")) return "text/html";
        if (path.endsWith(".json")) return "application/json";
        if (path.endsWith(".svg")) return "image/svg+xml";
        if (path.endsWith(".ttf")) return "font/ttf";
        String type = java.net.URLConnection.guessContentTypeFromName(path);
        return type == null ? "application/octet-stream" : type;
    }
    private static WebResourceResponse response(int status, String reason) {
        return new WebResourceResponse("text/plain","UTF-8",status,reason,Collections.emptyMap(),new ByteArrayInputStream(new byte[0]));
    }
    private void message(String text) { runOnUiThread(() -> Toast.makeText(this,text,Toast.LENGTH_LONG).show()); }
    private byte[] decode(String encoded, String mime) {
        if (!("application/pdf".equals(mime) || "image/png".equals(mime))) throw new IllegalArgumentException("type");
        if (encoded == null || encoded.length() > 40000000) throw new IllegalArgumentException("size");
        byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
        if ("application/pdf".equals(mime) && !(bytes.length > 5 && bytes[0]=='%' && bytes[1]=='P' && bytes[2]=='D' && bytes[3]=='F')) throw new IllegalArgumentException("PDF");
        if ("image/png".equals(mime) && !(bytes.length > 8 && bytes[0]==(byte)137 && bytes[1]=='P' && bytes[2]=='N' && bytes[3]=='G')) throw new IllegalArgumentException("PNG");
        return bytes;
    }
    private static String safeName(String name, String mime) {
        String result = name == null ? "matrix" : name.replaceAll("[^a-zA-Z0-9._-]", "_");
        String ext = "application/pdf".equals(mime) ? ".pdf" : ".png";
        if (!result.endsWith(ext)) result += ext;
        if (result.length() > 120) result = "matrix" + ext;
        return result;
    }
    private final class FilesBridge {
        @JavascriptInterface public void saveFile(String name, String mime, String base64) {
            try {
                final byte[] bytes = decode(base64,mime);
                runOnUiThread(() -> {
                    if (exporting) { message("Сначала завершите сохранение файла"); return; }
                    exporting = true;
                    pendingFile = bytes;
                    Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    intent.addCategory(Intent.CATEGORY_OPENABLE);
                    intent.setType(mime);
                    intent.putExtra(Intent.EXTRA_TITLE,safeName(name,mime));
                    try { startActivityForResult(intent,SAVE_DOCUMENT); }
                    catch (ActivityNotFoundException e) { pendingFile=null; exporting=false; message("Не найдено приложение для сохранения файлов"); }
                });
            } catch (RuntimeException e) { message("Не удалось подготовить файл"); }
        }
        @JavascriptInterface public void shareFile(String name, String mime, String base64, String text) {
            try {
                byte[] bytes = decode(base64,mime);
                File dir = new File(getCacheDir(),"exports");
                if (!dir.isDirectory() && !dir.mkdirs()) throw new IOException("directory");
                // Separate files allow the receiving app to finish reading an earlier share.
                String fileName = UUID.randomUUID().toString() + "-" + safeName(name,mime);
                File file = new File(dir,fileName);
                try (OutputStream out = new FileOutputStream(file)) { out.write(bytes); }
                Uri uri = Uri.parse("content://ru.kipin.natal.exports/" + fileName);
                runOnUiThread(() -> {
                    Intent share = new Intent(Intent.ACTION_SEND);
                    share.setType(mime);
                    share.putExtra(Intent.EXTRA_STREAM,uri);
                    share.putExtra(Intent.EXTRA_TEXT,text);
                    share.setClipData(ClipData.newRawUri("Натальная карта",uri));
                    share.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                    try { startActivity(Intent.createChooser(share,"Поделиться расчётом")); }
                    catch (ActivityNotFoundException e) { message("Не найдено приложение для отправки"); }
                });
            } catch (IOException | RuntimeException e) { message("Не удалось подготовить карточку"); }
        }
        @JavascriptInterface public void shareText(String text) {
            runOnUiThread(() -> {
                Intent share = new Intent(Intent.ACTION_SEND).setType("text/plain").putExtra(Intent.EXTRA_TEXT,text);
                try { startActivity(Intent.createChooser(share,"Поделиться расчётом")); }
                catch (ActivityNotFoundException e) { message("Не найдено приложение для отправки"); }
            });
        }
        @JavascriptInterface public void copyText(String text) {
            runOnUiThread(() -> ((android.content.ClipboardManager)getSystemService(CLIPBOARD_SERVICE)).setPrimaryClip(ClipData.newPlainText("Натальная карта",text)));
        }
    }
    @Override protected void onActivityResult(int request, int result, Intent data) {
        super.onActivityResult(request,result,data);
        if (request != SAVE_DOCUMENT) return;
        byte[] bytes = pendingFile;
        pendingFile = null; exporting = false;
        if (result != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
        final Uri uri = data.getData();
        new Thread(() -> {
            try (OutputStream out = getContentResolver().openOutputStream(uri)) {
                if (out == null) throw new IOException("output");
                out.write(bytes); message("Файл сохранён");
            } catch (IOException e) { message("Не удалось сохранить файл"); }
        },"natal-export").start();
    }
    @Override public void onBackPressed() { if (web.canGoBack()) web.goBack(); else super.onBackPressed(); }
    @Override protected void onDestroy() {
        web.removeJavascriptInterface("AndroidBridge"); web.destroy(); pendingFile=null;
        super.onDestroy();
    }
}
