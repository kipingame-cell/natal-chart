/* Native services for the packaged, offline Android build only. */
(() => {
  const readBase64 = blob => new Promise((resolve,reject) => {
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result).split(',')[1]);
    reader.onerror=()=>reject(reader.error);
    reader.readAsDataURL(blob);
  });
  navigator.canShare = data => !data.files || (data.files.length === 1 && ['image/png','application/pdf'].includes(data.files[0].type));
  navigator.share = async data => {
    if (data.files?.length) {
      const file=data.files[0];
      AndroidBridge.shareFile(file.name,file.type,await readBase64(file),[data.text,data.url].filter(Boolean).join('\n'));
    } else AndroidBridge.shareText([data.title,data.text,data.url].filter(Boolean).join('\n'));
  };
  Object.defineProperty(navigator,'clipboard',{value:{writeText:async text=>AndroidBridge.copyText(String(text))},configurable:true});
  window.addEventListener('DOMContentLoaded',()=>{
    document.getElementById('btnGeo')?.remove();
    document.querySelector('.android-download')?.remove();
    document.querySelector('.header-tag').textContent = 'офлайн · версия 1.0.0';
    document.querySelector('.logo-link')?.setAttribute('href','./app.html');
    const badge=document.getElementById('dbBadge');
    if(badge) badge.title='Все данные находятся внутри приложения';
  });
})();
