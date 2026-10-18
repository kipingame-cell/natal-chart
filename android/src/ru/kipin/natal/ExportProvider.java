package ru.kipin.natal;

import android.content.*;
import android.database.Cursor;
import android.database.MatrixCursor;
import android.net.Uri;
import android.os.ParcelFileDescriptor;
import android.provider.OpenableColumns;
import java.io.*;

/** Read-only, temporarily granted access to generated PNG/PDF exports. */
public final class ExportProvider extends ContentProvider {
    @Override public boolean onCreate() { return true; }
    private File resolve(Uri uri) throws FileNotFoundException {
        String name = uri.getLastPathSegment();
        if (name == null || !name.matches("[a-zA-Z0-9._-]+") || name.contains("..")) throw new FileNotFoundException();
        File file = new File(new File(getContext().getCacheDir(),"exports"),name);
        if (!file.isFile()) throw new FileNotFoundException();
        return file;
    }
    @Override public ParcelFileDescriptor openFile(Uri uri, String mode) throws FileNotFoundException {
        if (!"r".equals(mode)) throw new FileNotFoundException("Read only");
        return ParcelFileDescriptor.open(resolve(uri),ParcelFileDescriptor.MODE_READ_ONLY);
    }
    @Override public String getType(Uri uri) { return uri.toString().endsWith(".pdf") ? "application/pdf" : "image/png"; }
    @Override public Cursor query(Uri uri, String[] projection, String selection, String[] args, String sort) {
        String[] columns = projection == null ? new String[]{OpenableColumns.DISPLAY_NAME,OpenableColumns.SIZE} : projection;
        MatrixCursor cursor = new MatrixCursor(columns);
        try {
            File file=resolve(uri); Object[] row=new Object[columns.length];
            for(int i=0;i<columns.length;i++) {
                if(OpenableColumns.DISPLAY_NAME.equals(columns[i])) row[i]=file.getName();
                if(OpenableColumns.SIZE.equals(columns[i])) row[i]=file.length();
            }
            cursor.addRow(row);
        } catch(FileNotFoundException e) { /* Missing exports return an empty result. */ }
        return cursor;
    }
    @Override public Uri insert(Uri uri,ContentValues values) { throw new UnsupportedOperationException(); }
    @Override public int delete(Uri uri,String selection,String[] args) { throw new UnsupportedOperationException(); }
    @Override public int update(Uri uri,ContentValues values,String selection,String[] args) { throw new UnsupportedOperationException(); }
}
