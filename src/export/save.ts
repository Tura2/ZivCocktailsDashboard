export function saveBytesAsFile(bytes: ArrayBuffer | Uint8Array, filename: string, mimeType: string) {
  const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  // Copy into a real ArrayBuffer (avoids SharedArrayBuffer/ArrayBufferLike type issues).
  const ab = new ArrayBuffer(data.byteLength);
  new Uint8Array(ab).set(data);
  const blob = new Blob([ab], { type: mimeType });

  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function saveTextAsFile(text: string, filename: string, mimeType: string) {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
