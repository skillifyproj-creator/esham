// A single image page preserves the browser's Arabic shaping and corporate font.
// At 300 dpi it prints sharply on landscape A4 without pagination dependence.
export function onePagePdf(jpeg, width, height) {
  const encoder = new TextEncoder(), chunks = [], offsets = [0]; let length = 0;
  const add = value => { const bytes = typeof value === 'string' ? encoder.encode(value) : value; chunks.push(bytes); length += bytes.length; };
  const object = (id, body) => { offsets[id] = length; add(`${id} 0 obj\n${body}\nendobj\n`); };
  add('%PDF-1.4\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  object(3, '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 841.89 595.28] /Resources << /XObject << /Certificate 4 0 R >> >> /Contents 5 0 R >>');
  offsets[4] = length;
  add(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
  add(jpeg); add('\nendstream\nendobj\n');
  const content = 'q\n841.89 0 0 595.28 0 0 cm\n/Certificate Do\nQ\n';
  object(5, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
  const xref = length;
  add('xref\n0 6\n0000000000 65535 f \n');
  for (let id = 1; id <= 5; id++) add(`${String(offsets[id]).padStart(10,'0')} 00000 n \n`);
  add(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(chunks, { type: 'application/pdf' });
}
function lines(context, text, maxWidth) {
  const words = String(text).split(/\s+/), result = []; let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (context.measureText(next).width > maxWidth && line) { result.push(line); line = word; }
    else line = next;
  }
  if (line) result.push(line);
  return result;
}
export async function createCertificatePdf({ name, course, instructor, language = 'ar', logo, verificationId, issuedAt }) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas'); canvas.width = 3508; canvas.height = 2480;
  const context = canvas.getContext('2d'), w = canvas.width, h = canvas.height;
  const ar = language === 'ar', t = (a,e) => ar ? a : e;
  context.fillStyle = '#fffefa'; context.fillRect(0,0,w,h);
  context.strokeStyle = '#a18a5e'; context.lineWidth = 8; context.strokeRect(125,125,w-250,h-250);
  context.lineWidth = 2; context.strokeRect(154,154,w-308,h-308);
  context.textAlign = 'center'; context.direction = ar ? 'rtl' : 'ltr';
  function text(value, y, size, bold = false, maxLines = 1, x = w/2, maxWidth = w-550) {
    let currentSize = size, wrapped;
    do { context.font = `${bold ? '600' : '400'} ${currentSize}px Arial, Tahoma, sans-serif`; wrapped = lines(context,value,maxWidth); currentSize -= 2; } while ((wrapped.length > maxLines || wrapped.some(line=>context.measureText(line).width > maxWidth)) && currentSize > 24);
    context.fillStyle = '#173447'; wrapped.forEach((line,index)=>context.fillText(line,x,y+index*(currentSize+18)));
  }
  if (logo) {
    const image = new Image(); image.src = logo; await image.decode();
    const ratio = Math.min(490/image.width,230/image.height); context.drawImage(image,(w-image.width*ratio)/2,240,image.width*ratio,image.height*ratio);
  }
  text(t('منصة إسهام للتعلّم ومشاركة المعرفة','ESHAM · LEARNING AND SHARING KNOWLEDGE'),565,44);
  text(t('شهادة إكمال دورة','CERTIFICATE OF COMPLETION'),775,124,true);
  text(t('تُقدّم هذه الشهادة إلى','Presented to'),1015,56);
  text(name,1190,112,true,2);
  text(t('لإتمام متطلبات الدورة التدريبية','For completing the requirements of'),1510,56);
  text(course,1685,84,true,3);
  context.strokeStyle = '#d7cab1'; context.lineWidth = 3; context.beginPath(); context.moveTo(390,2070); context.lineTo(w-390,2070); context.stroke();
  text(instructor,2180,52,true,2,w*.28,1050);
  text(t('مدرّب الدورة','Course instructor'),2300,38,false,1,w*.28,1050);
  text(t('صادرة عن منصة إسهام','Issued by Esham'),2180,52,true,1,w*.72,1050);
  text(issuedAt ? `${t('تاريخ الإصدار','Issue date')}: ${issuedAt}` : t('تاريخ الإصدار: بانتظار الاعتماد','Issue date: awaiting approval'),2240,32,false,1,w*.72,1050);
  text(verificationId ? `${t('رقم التحقق','Verification ID')}: ${verificationId}` : t('الاعتماد ورقم التحقق: بانتظار الربط','Approval and verification ID: awaiting service'),2300,30,false,1,w*.72,1050);
  if (!verificationId) {
    context.save(); context.translate(w/2,h/2); context.rotate(-.2); context.globalAlpha = .065; context.font = '600 260px Arial'; context.fillStyle = '#173447'; context.fillText(t('معاينة','PREVIEW'),0,0); context.restore();
  }
  const jpegBlob = await new Promise(resolve => canvas.toBlob(resolve,'image/jpeg',.95));
  if (!jpegBlob) throw new Error('certificate-render');
  return onePagePdf(new Uint8Array(await jpegBlob.arrayBuffer()),w,h);
}
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob), anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click();
  setTimeout(()=>URL.revokeObjectURL(url),10000);
}
