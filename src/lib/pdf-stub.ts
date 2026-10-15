/**
 * Stands in for jsPDF and svg2pdf.js, which SVG-Edit imports only for its PDF export. svgw never
 * exports PDFs, and the real libraries (with html2canvas and canvg behind them) would more than
 * double the editor's download.
 */
export class jsPDF {
  constructor() {
    throw new Error('PDF export is not available in svgw.')
  }
}
