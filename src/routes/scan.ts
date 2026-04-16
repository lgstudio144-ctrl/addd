import { Router } from 'express';
import type { Request, Response } from 'express';
import multer from 'multer';
import jsQR from 'jsqr';
import { Jimp } from 'jimp';
import { store } from '../store';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

/**
 * Decode a QR code from raw image bytes using Jimp + jsQR.
 */
async function decodeQRFromBuffer(buffer: Buffer): Promise<string | null> {
  const image = await Jimp.read(buffer);
  const { data, width, height } = image.bitmap;
  const result = jsQR(new Uint8ClampedArray(data.buffer), width, height);
  return result ? result.data : null;
}

/**
 * POST /scan
 *
 * Accepts either:
 *   • JSON body  { barcode: string }  — raw barcode/QR string from a hardware scanner
 *   • multipart/form-data with field "image" — JPEG/PNG containing a QR code
 *
 * Returns the matching product (if registered) or a 404 with the decoded barcode so the
 * caller can register it first.
 */
router.post('/', upload.single('image'), async (req: Request, res: Response): Promise<void> => {
  let barcode: string | null = null;

  if (req.file) {
    // Image upload path — decode QR from the uploaded image
    const decoded = await decodeQRFromBuffer(req.file.buffer);
    if (!decoded) {
      res.status(422).json({ error: 'No QR code detected in the uploaded image' });
      return;
    }
    barcode = decoded;
  } else if (typeof (req.body as { barcode?: unknown }).barcode === 'string') {
    // Hardware scanner / direct barcode string path
    barcode = (req.body as { barcode: string }).barcode.trim();
  }

  if (!barcode) {
    res
      .status(400)
      .json({ error: 'Provide a "barcode" string in the body or an "image" file upload' });
    return;
  }

  const product = store.getProductByBarcode(barcode);
  if (!product) {
    res.status(404).json({
      barcode,
      error: 'No product registered for this barcode — register it first via POST /products',
    });
    return;
  }

  res.json({
    barcode,
    product,
    currentLocation: store.currentLocation(product.id),
  });
});

export default router;
