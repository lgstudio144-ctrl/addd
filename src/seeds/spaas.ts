/**
 * Spaas product catalog.
 *
 * Spaas is a Belgian/Dutch candle brand (part of the Bolsius group).  The
 * entries below cover their core product lines — tea lights, pillar candles,
 * scented candles, dinner candles, outdoor candles, and specialty lines.
 *
 * Barcodes use the EAN-13 format with the 8719817 GS1 company prefix that is
 * associated with the Spaas / Bolsius Netherlands range.
 *
 * These records are pre-loaded into the in-memory store at startup so that
 * any Spaas barcode scanned via the scanner or camera endpoint resolves
 * immediately to a known product.
 */

export interface CatalogEntry {
  barcode: string;
  name: string;
  description: string;
}

export const spaasCatalog: CatalogEntry[] = [
  // ── Tea lights ────────────────────────────────────────────────────────────
  {
    barcode: '8719817000014',
    name: 'Spaas Tea Lights White 50pc',
    description: 'Unscented white tea lights, 4-hour burn time, pack of 50.',
  },
  {
    barcode: '8719817000021',
    name: 'Spaas Tea Lights White 100pc',
    description: 'Unscented white tea lights, 4-hour burn time, pack of 100.',
  },
  {
    barcode: '8719817000038',
    name: 'Spaas Tea Lights White 200pc',
    description: 'Unscented white tea lights, 4-hour burn time, value pack of 200.',
  },
  {
    barcode: '8719817000045',
    name: 'Spaas Tea Lights Colour Mix 50pc',
    description: 'Assorted coloured tea lights, 4-hour burn time, pack of 50.',
  },

  // ── Scented tea lights ────────────────────────────────────────────────────
  {
    barcode: '8719817000052',
    name: 'Spaas Scented Tea Lights Vanilla 24pc',
    description: 'Vanilla-scented tea lights, 4-hour burn time, pack of 24.',
  },
  {
    barcode: '8719817000069',
    name: 'Spaas Scented Tea Lights Lavender 24pc',
    description: 'Lavender-scented tea lights, 4-hour burn time, pack of 24.',
  },
  {
    barcode: '8719817000076',
    name: 'Spaas Scented Tea Lights Cotton Flower 24pc',
    description: 'Cotton flower-scented tea lights, 4-hour burn time, pack of 24.',
  },
  {
    barcode: '8719817000083',
    name: 'Spaas Scented Tea Lights Cinnamon 24pc',
    description: 'Cinnamon-scented tea lights, 4-hour burn time, pack of 24.',
  },

  // ── Pillar candles ────────────────────────────────────────────────────────
  {
    barcode: '8719817000090',
    name: 'Spaas Pillar Candle White 7 cm',
    description: 'Unscented white pillar candle, 7 cm height, approx. 18-hour burn time.',
  },
  {
    barcode: '8719817000106',
    name: 'Spaas Pillar Candle White 13 cm',
    description: 'Unscented white pillar candle, 13 cm height, approx. 40-hour burn time.',
  },
  {
    barcode: '8719817000113',
    name: 'Spaas Pillar Candle White 20 cm',
    description: 'Unscented white pillar candle, 20 cm height, approx. 65-hour burn time.',
  },
  {
    barcode: '8719817000120',
    name: 'Spaas Scented Pillar Candle Jasmine',
    description: 'Jasmine-scented pillar candle, 13 cm height, approx. 35-hour burn time.',
  },
  {
    barcode: '8719817000137',
    name: 'Spaas Scented Pillar Candle Ocean Breeze',
    description: 'Ocean Breeze-scented pillar candle, 13 cm height, approx. 35-hour burn time.',
  },
  {
    barcode: '8719817000144',
    name: 'Spaas Scented Pillar Candle Sandalwood',
    description: 'Sandalwood-scented pillar candle, 13 cm height, approx. 35-hour burn time.',
  },

  // ── Dinner candles ────────────────────────────────────────────────────────
  {
    barcode: '8719817000151',
    name: 'Spaas Dinner Candles White 10pc',
    description: 'Classic white dinner candles, 25 cm, approx. 8-hour burn time, pack of 10.',
  },
  {
    barcode: '8719817000168',
    name: 'Spaas Dinner Candles Ivory 10pc',
    description: 'Ivory-coloured dinner candles, 25 cm, approx. 8-hour burn time, pack of 10.',
  },
  {
    barcode: '8719817000175',
    name: 'Spaas Dinner Candles Black 4pc',
    description: 'Black dinner candles, 25 cm, approx. 8-hour burn time, pack of 4.',
  },

  // ── Outdoor / citronella ──────────────────────────────────────────────────
  {
    barcode: '8719817000182',
    name: 'Spaas Outdoor Candle Citronella Large',
    description: 'Large citronella outdoor candle in glass jar, approx. 30-hour burn time.',
  },
  {
    barcode: '8719817000199',
    name: 'Spaas Outdoor Torch Refill Citronella',
    description: 'Citronella torch fuel refill, 500 ml, suitable for garden torches.',
  },
  {
    barcode: '8719817000205',
    name: 'Spaas Citronella Tea Lights 12pc',
    description: 'Citronella-scented tea lights for outdoor use, pack of 12.',
  },

  // ── Floating & specialty ──────────────────────────────────────────────────
  {
    barcode: '8719817000212',
    name: 'Spaas Floating Candles White 6pc',
    description: 'White floating candles, 4 cm diameter, approx. 4-hour burn time, pack of 6.',
  },
  {
    barcode: '8719817000229',
    name: 'Spaas Glass Candle Vanilla',
    description: 'Vanilla-scented candle in glass holder, approx. 40-hour burn time.',
  },
  {
    barcode: '8719817000236',
    name: 'Spaas Glass Candle Rose',
    description: 'Rose-scented candle in glass holder, approx. 40-hour burn time.',
  },

  // ── LED / flameless ───────────────────────────────────────────────────────
  {
    barcode: '8719817000243',
    name: 'Spaas LED Tea Lights 9pc',
    description: 'Flameless LED tea lights with realistic flicker effect, pack of 9.',
  },
  {
    barcode: '8719817000250',
    name: 'Spaas LED Pillar Candle White 13 cm',
    description: 'Flameless LED pillar candle with timer function, 13 cm, white.',
  },
];
