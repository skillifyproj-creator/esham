import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
export const DOCUMENT_LIMIT = 16000;
export async function prepareChatImage(file) {
  if (!file || file.size > 10 * 1024 * 1024 || !['image/jpeg','image/png','image/webp','image/gif'].includes(file.type)) throw new Error('image-format');
  const bitmap=await createImageBitmap(file);
  try {
    if(bitmap.width*bitmap.height>32000000)throw new Error('image-size');
    const scale=Math.min(1,1280/Math.max(bitmap.width,bitmap.height));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(bitmap.width*scale));canvas.height=Math.max(1,Math.round(bitmap.height*scale));
    const context=canvas.getContext('2d');context.fillStyle='#fff';context.fillRect(0,0,canvas.width,canvas.height);context.drawImage(bitmap,0,0,canvas.width,canvas.height);
    const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',0.85));
    if(!blob || blob.size>2*1024*1024)throw new Error('image-size');
    const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';
    for(let start=0;start<bytes.length;start+=8192)binary+=String.fromCharCode(...bytes.subarray(start,start+8192));
    return {name:file.name.slice(0,160),mimeType:'image/jpeg',data:btoa(binary)};
  }finally{bitmap.close();}
}
export async function extractChatDocument(file) {
  if (!file || file.size > 10 * 1024 * 1024) throw new Error('document-size');
  let text = '', truncated = false, pages = 0;
  if (file.type === 'text/plain') {
    text = await file.text();
    if (text.includes('\u0000')) throw new Error('document-format');
  } else if (file.type === 'application/pdf') {
    const pdf = await import('pdfjs-dist');
    pdf.GlobalWorkerOptions.workerSrc = pdfWorker;
    const task = pdf.getDocument({data:new Uint8Array(await file.arrayBuffer()),isEvalSupported:false,stopAtErrors:true});
    // Password protected files are unsupported; do not leave a pending password dialog.
    task.onPassword = () => task.destroy();
    let document;
    try {
      document = await task.promise;
      for (let n=1;n<=Math.min(document.numPages,20);n++) {
        const page=await document.getPage(n), content=await page.getTextContent();
        text += `\n[Page ${n}]\n` + content.items.map(item=>item.str || '').join(' ');
        pages=n;
        if (text.length >= DOCUMENT_LIMIT) break;
      }
      truncated=pages<document.numPages;
    } finally { await task.destroy(); }
  } else throw new Error('document-format');
  if (!text.replace(/\[Page \d+\]/g,'').trim()) throw new Error('document-empty');
  truncated ||= text.length > DOCUMENT_LIMIT;
  return {name:file.name.slice(0,160),text:text.slice(0,DOCUMENT_LIMIT),truncated,pages};
}
