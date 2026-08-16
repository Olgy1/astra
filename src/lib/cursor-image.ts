/**
 * Décode un fichier de curseur `.cur` / `.ico` côté client.
 *
 * Les navigateurs n'affichent pas `.cur` dans une balise `<img>` (Chrome et
 * Safari le refusent ; Firefox l'accepte). Or c'est LE format natif des
 * curseurs Windows, et il porte aussi le point actif (hotspot) dans ses
 * métadonnées — deux raisons de le décoder plutôt que de le laisser tomber.
 *
 * Le format CUR est un conteneur ICO (en-tête identique, type 2 au lieu de 1)
 * contenant une ou plusieurs images : soit un PNG embarqué (cas moderne, on
 * le réutilise tel quel), soit un BMP/DIB (cas ancien, on le décode dans un
 * canvas puis on exporte en PNG). On garde la plus grande image déclarée.
 */

export type CurImage = {
  /** URL objet (blob:...) de l'image convertie en PNG. */
  url: string;
  /** Point actif déclaré par le fichier, en pixels. */
  hotspotX: number;
  hotspotY: number;
} | null;

const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

function u16(view: DataView, offset: number): number {
  return view.getUint16(offset, true);
}

function u32(view: DataView, offset: number): number {
  return view.getUint32(offset, true);
}

/** Décode un BMP/DIB embarqué dans un ICO/CUR en ImageData. */
function decodeDib(
  view: DataView,
  start: number,
  length: number
): { width: number; height: number; imageData: ImageData } | null {
  if (length < 40) return null;
  const biWidth = view.getInt32(start + 4, true);
  // Dans un ICO, la hauteur déclarée double la hauteur réelle : la moitié
  // basse est l'image, la moitié haute est le masque de transparence (AND).
  const biHeight = view.getInt32(start + 8, true) / 2;
  const biBitCount = u16(view, start + 14);
  if (biWidth <= 0 || biHeight <= 0) return null;

  // Palette (bitCount ≤ 8) : 4 octets BGRA par couleur, lus juste après
  // l'en-tête BITMAPINFOHEADER.
  let palette: Uint8ClampedArray | null = null;
  let paletteBytes = 0;
  if (biBitCount <= 8) {
    const colors = 1 << biBitCount;
    paletteBytes = colors * 4;
    if (start + 40 + paletteBytes > view.byteLength) return null;
    palette = new Uint8ClampedArray(view.buffer, start + 40, paletteBytes);
  }

  const dataStart = start + 40 + paletteBytes;
  // Chaque ligne de pixels est alignée sur 4 octets.
  const rowStride = Math.floor((biWidth * biBitCount + 31) / 32) * 4;
  // Masque AND : 1 bit par pixel, lignes alignées sur 4 octets, top-down.
  const maskStride = Math.floor((biWidth + 31) / 32) * 4;
  const maskStart = dataStart + rowStride * biHeight;

  const imageData = new ImageData(biWidth, biHeight);
  const out = imageData.data;

  function paletteColor(index: number): [number, number, number, number] {
    if (!palette) return [255, 255, 255, 255];
    const o = index * 4;
    return [palette[o + 2], palette[o + 1], palette[o], palette[o + 3]];
  }

  for (let row = 0; row < biHeight; row++) {
    // Les lignes BMP sont stockées de bas en haut.
    const y = biHeight - 1 - row;
    const rowOffset = dataStart + row * rowStride;
    const maskRowOffset = maskStart + row * maskStride;

    for (let x = 0; x < biWidth; x++) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 255;

      if (biBitCount === 32) {
        const o = rowOffset + x * 4;
        if (o + 3 >= view.byteLength) continue;
        b = view.getUint8(o);
        g = view.getUint8(o + 1);
        r = view.getUint8(o + 2);
        a = view.getUint8(o + 3);
      } else if (biBitCount === 24) {
        const o = rowOffset + x * 3;
        if (o + 2 >= view.byteLength) continue;
        b = view.getUint8(o);
        g = view.getUint8(o + 1);
        r = view.getUint8(o + 2);
      } else if (biBitCount === 8 || biBitCount === 4 || biBitCount === 1) {
        const bitsPerByte = 8 / biBitCount;
        const byteIndex = Math.floor(x / bitsPerByte);
        const shift = 8 - biBitCount * (x % bitsPerByte) - biBitCount;
        const o = rowOffset + byteIndex;
        if (o >= view.byteLength) continue;
        const index = (view.getUint8(o) >> shift) & ((1 << biBitCount) - 1);
        [r, g, b, a] = paletteColor(index);
      } else {
        // 16 bits (RGB 555/565) : rare dans les curseurs, on saute proprement.
        continue;
      }

      // Masque AND : bit à 1 → pixel transparent. Pour du 32 bits, le canal
      // alpha du pixel est conservé quand le masque ne force pas la
      // transparence.
      const maskByte = view.getUint8(maskRowOffset + Math.floor(x / 8));
      const maskBit = (maskByte >> (7 - (x % 8))) & 1;
      if (maskBit === 1) a = 0;

      const o = (y * biWidth + x) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = a;
    }
  }

  return { width: biWidth, height: biHeight, imageData };
}

/**
 * Parse un buffer ICO/CUR et renvoie l'image la plus grande en PNG, avec le
 * hotspot (uniquement présent dans les .cur). `null` si le fichier n'est pas
 * un ICO/CUR exploitable.
 */
export async function parseCurFile(buffer: ArrayBuffer): Promise<CurImage> {
  const view = new DataView(buffer);
  if (view.byteLength < 6) return null;

  const type = u16(view, 2);
  // 1 = ICO, 2 = CUR — tout autre conteneur n'est pas notre affaire.
  if (type !== 1 && type !== 2) return null;

  const count = u16(view, 4);
  if (count === 0) return null;

  // Sélectionne l'entrée la plus grande (surface maximale).
  let best = -1;
  let bestScore = 0;
  let hotspotX = 0;
  let hotspotY = 0;

  for (let i = 0; i < count; i++) {
    const entry = 6 + i * 16;
    if (entry + 16 > view.byteLength) break;
    const w = view.getUint8(entry) || 256;
    const h = view.getUint8(entry + 1) || 256;
    const score = w * h;
    if (score > bestScore) {
      bestScore = score;
      best = i;
      if (type === 2) {
        // Dans un .cur, les champs planes/bitCount portent le hotspot.
        hotspotX = u16(view, entry + 4);
        hotspotY = u16(view, entry + 6);
      }
    }
  }

  if (best < 0) return null;

  const entry = 6 + best * 16;
  const bytesInRes = u32(view, entry + 8);
  const imageOffset = u32(view, entry + 12);
  if (imageOffset + bytesInRes > view.byteLength || bytesInRes < 4) return null;

  const dataStart = imageOffset;
  const isPng =
    view.getUint8(dataStart) === PNG_MAGIC[0] &&
    view.getUint8(dataStart + 1) === PNG_MAGIC[1] &&
    view.getUint8(dataStart + 2) === PNG_MAGIC[2] &&
    view.getUint8(dataStart + 3) === PNG_MAGIC[3];

  if (isPng) {
    // PNG embarqué : réutilisable tel quel.
    const blob = new Blob([buffer.slice(dataStart, dataStart + bytesInRes)], {
      type: "image/png",
    });
    return { url: URL.createObjectURL(blob), hotspotX, hotspotY };
  }

  // BMP/DIB : on décode dans un canvas, puis on exporte en PNG.
  const decoded = decodeDib(view, dataStart, bytesInRes);
  if (!decoded) return null;

  const canvas = document.createElement("canvas");
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.putImageData(decoded.imageData, 0, 0);

  const url = await new Promise<string | null>((resolve) => {
    canvas.toBlob((blob) => {
      if (!blob) return resolve(null);
      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
  if (!url) return null;

  return { url, hotspotX, hotspotY };
}
