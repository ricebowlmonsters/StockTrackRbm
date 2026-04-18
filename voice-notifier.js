/**
 * Voice Notification Service - Rice Bowl Monster
 * Fitur: Memanggil nomor meja saat pesanan siap diambil.
 */

const VoiceNotifier = {
    voices: [],
    queue: [],
    isSpeaking: false,

    // Inisialisasi suara saat file dimuat
    init: function() {
        if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
            // Memuat daftar suara yang tersedia di browser
            this.voices = window.speechSynthesis.getVoices();
            
            // Chrome memuat suara secara asinkron, jadi kita perlu listener ini
            window.speechSynthesis.onvoiceschanged = () => {
                this.voices = window.speechSynthesis.getVoices();
            };

            // Fix untuk Mobile Browser: Unlock audio context pada interaksi pertama
            // Ini penting agar suara bisa keluar di Android/iOS
            const unlockAudio = () => {
                const u = new SpeechSynthesisUtterance("");
                window.speechSynthesis.speak(u);
                // Hapus listener setelah berhasil di-unlock
                document.removeEventListener('click', unlockAudio);
                document.removeEventListener('touchstart', unlockAudio);
            };
            document.addEventListener('click', unlockAudio);
            document.addEventListener('touchstart', unlockAudio);

        } else {
            console.warn("Browser ini tidak mendukung fitur Text-to-Speech.");
        }
    },

    /**
     * Menambahkan pesan ke antrian agar tidak tumpang tindih
     */
    addToQueue: function(text, rate = 0.9) {
        this.queue.push({ text, rate });
        this.processQueue();
    },

    /**
     * Memproses antrian suara satu per satu
     */
    processQueue: function() {
        if (this.isSpeaking || this.queue.length === 0) return;

        this.isSpeaking = true;
        const item = this.queue.shift();
        
        // Pastikan stop dulu sebelum mulai (reset state)
        if(window.speechSynthesis) window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(item.text);
        utterance.lang = 'id-ID';
        utterance.rate = item.rate;
        utterance.pitch = 1.0;
        utterance.volume = 1.0;

        const indoVoice = this.voices.find(v => v.lang.includes('id-ID') || v.lang.includes('id_ID'));
        if (indoVoice) utterance.voice = indoVoice;

        // Keep-alive hack untuk menjaga suara tetap jalan di Chrome
        const keepAlive = setInterval(() => {
            if (window.speechSynthesis.paused) window.speechSynthesis.resume();
        }, 200);

        utterance.onend = () => {
            clearInterval(keepAlive);
            this.isSpeaking = false;
            setTimeout(() => this.processQueue(), 300); // Jeda sedikit antar pesan
        };

        utterance.onerror = () => {
            clearInterval(keepAlive);
            this.isSpeaking = false;
            this.processQueue();
        };

        if(window.speechSynthesis) window.speechSynthesis.speak(utterance);
    },

    /**
     * Membunyikan notifikasi panggilan nomor meja
     * @param {string|number} tableNumber - Nomor meja yang akan dipanggil
     */
    announce: function(tableNumber) {
        if (!('speechSynthesis' in window)) return;
        // [DIUBAH] Jika tidak ada nomor meja, ucapkan kalimat umum
        const text = tableNumber 
            ? `Pesanan dengan nomor meja ${tableNumber}, siap diambil.`
            : `Pesanan siap diambil.`;
        this.addToQueue(text, 0.9);
    },

    /**
     * Membunyikan notifikasi pesanan baru masuk dari nomor meja
     * @param {string|number} tableNumber - Nomor meja yang akan dipanggil
     */
    announceNewOrder: function(tableNumber) {
        if (!('speechSynthesis' in window)) return;
        // [DIUBAH] Jika tidak ada nomor meja, ucapkan kalimat umum
        const text = tableNumber 
            ? `Pesanan baru masuk dari nomor meja ${tableNumber}`
            : `Pesanan baru masuk.`;
        this.addToQueue(text, 0.85);
    },

    /**
     * Membunyikan notifikasi Kode Unik
     * @param {string|number} code - Kode yang akan dipanggil
     */
    announceUniqueCode: function(code) {
        if (!('speechSynthesis' in window) || !code) return;
        
        // Memisahkan karakter dengan spasi agar dibaca eja (spelling) supaya jelas
        const spelledCode = code.toString().split('').join(' ');
        const text = `Kode unik, ${spelledCode}`;
        this.addToQueue(text, 0.85);
    }
};

// Jalankan inisialisasi
VoiceNotifier.init();