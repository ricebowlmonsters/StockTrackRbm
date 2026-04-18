/**
 * QR Code Scanner untuk Input Point dan Klaim VCR
 * Menggunakan QuaggaJS untuk scanning QR code
 */

class QRScanner {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = {
      width: 300,
      height: 300,
      onSuccess: options.onSuccess || (() => {}),
      onError: options.onError || (() => {}),
      onStart: options.onStart || (() => {}),
      onStop: options.onStop || (() => {}),
      ...options
    };
    this.isScanning = false;
    this.stream = null;
  }

  async start() {
    try {
      this.options.onStart();
      
      // Cek apakah browser mendukung getUserMedia
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser tidak mendukung kamera');
      }

      // Request akses kamera
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment', // Gunakan kamera belakang
          width: { ideal: 640 },
          height: { ideal: 480 }
        }
      });

      // Buat video element
      const video = document.createElement('video');
      video.id = 'qr-video';
      video.srcObject = this.stream;
      video.autoplay = true;
      video.playsInline = true;
      video.style.width = '100%';
      video.style.height = '100%';
      video.style.objectFit = 'cover';

      // Clear container dan tambahkan video
      this.container.innerHTML = '';
      this.container.appendChild(video);
      this.container.classList.add('has-camera');

      // Tambahkan overlay untuk scanning area
      const overlay = document.createElement('div');
      overlay.className = 'scan-overlay';
      this.container.appendChild(overlay);

      // Setup QR code detection
      this.setupQRDetection(video);

      this.isScanning = true;

    } catch (error) {
      console.error('Error starting camera:', error);
      this.options.onError(error.message);
      this.showFallbackInput();
    }
  }

  setupQRDetection(video) {
    // Import QuaggaJS secara dinamis
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/quagga/0.12.1/quagga.min.js';
    script.onload = () => {
      Quagga.init({
        inputStream: {
          name: "Live",
          type: "LiveStream",
          target: video,
          constraints: {
            width: 640,
            height: 480,
            facingMode: "environment"
          }
        },
        decoder: {
          readers: ["code_128_reader", "ean_reader", "ean_8_reader", "code_39_reader", "code_39_vin_reader", "codabar_reader", "upc_reader", "upc_e_reader", "i2of5_reader"]
        },
        locate: true,
        locator: {
          patchSize: "medium",
          halfSample: true
        }
      }, (err) => {
        if (err) {
          console.error('Quagga initialization error:', err);
          this.options.onError('Gagal menginisialisasi scanner');
          return;
        }
        Quagga.start();
      });

      Quagga.onDetected((result) => {
        const code = result.codeResult.code;
        this.stop();
        this.options.onSuccess(code);
      });
    };
    document.head.appendChild(script);
  }

  stop() {
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    
    if (typeof Quagga !== 'undefined') {
      Quagga.stop();
    }
    
    this.isScanning = false;
    this.options.onStop();
  }

  showFallbackInput() {
    this.container.innerHTML = `
      <div class="qr-scanner-placeholder">
        <p>Kamera tidak tersedia</p>
        <p>Silakan masukkan kode secara manual:</p>
        <input type="text" id="manual-code-input" class="form-input" placeholder="Masukkan kode QR" style="margin-top: 10px;">
        <button id="manual-submit" class="btn btn-primary" style="margin-top: 10px;">Submit</button>
      </div>
    `;

    // Setup manual input
    const manualInput = document.getElementById('manual-code-input');
    const manualSubmit = document.getElementById('manual-submit');
    
    const handleManualSubmit = () => {
      const code = manualInput.value.trim();
      if (code) {
        this.options.onSuccess(code);
      }
    };

    manualSubmit.addEventListener('click', handleManualSubmit);
    manualInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        handleManualSubmit();
      }
    });
  }

  // Method untuk generate QR code
  static generateQR(text, size = 200) {
    const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${encodeURIComponent(text)}`;
    return qrUrl;
  }

  // Method untuk validasi format kode
  static validateCode(code, type = 'any') {
    if (!code || typeof code !== 'string') {
      return { valid: false, message: 'Kode tidak valid' };
    }

    const trimmedCode = code.trim();
    
    if (trimmedCode.length === 0) {
      return { valid: false, message: 'Kode tidak boleh kosong' };
    }

    // Validasi berdasarkan tipe
    switch (type) {
      case 'point':
        // Format: POINT_<timestamp>_<user_id>_<amount>
        const pointPattern = /^POINT_\d+_[A-Za-z0-9]+_\d+$/;
        if (!pointPattern.test(trimmedCode)) {
          return { valid: false, message: 'Format kode point tidak valid' };
        }
        break;
        
      case 'voucher':
        // Format: VCR_<timestamp>_<voucher_id>_<user_id>
        const voucherPattern = /^VCR_\d+_[A-Za-z0-9]+_[A-Za-z0-9]+$/;
        if (!voucherPattern.test(trimmedCode)) {
          return { valid: false, message: 'Format kode voucher tidak valid' };
        }
        break;
        
      case 'any':
      default:
        // Minimal validasi untuk kode apapun
        if (trimmedCode.length < 3) {
          return { valid: false, message: 'Kode terlalu pendek' };
        }
        break;
    }

    return { valid: true, message: 'Kode valid' };
  }

  // Method untuk parse kode point
  static parsePointCode(code) {
    const parts = code.split('_');
    if (parts.length !== 4 || parts[0] !== 'POINT') {
      return null;
    }

    return {
      type: 'point',
      timestamp: parseInt(parts[1]),
      userId: parts[2],
      amount: parseInt(parts[3])
    };
  }

  // Method untuk parse kode voucher
  static parseVoucherCode(code) {
    const parts = code.split('_');
    if (parts.length !== 4 || parts[0] !== 'VCR') {
      return null;
    }

    return {
      type: 'voucher',
      timestamp: parseInt(parts[1]),
      voucherId: parts[2],
      userId: parts[3]
    };
  }
}

// Export untuk penggunaan global
window.QRScanner = QRScanner;
