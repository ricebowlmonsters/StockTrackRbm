// =================================================================
//            SUMBER DATA MENU PRODUK (SOURCE OF TRUTH)
// =================================================================
// Edit file ini untuk mengubah daftar produk yang tampil di kasir dan halaman menu.
// =================================================================

const RBM_MENU_DATA = [
    {
        category: "Rice Bowl",
        items: [
            { name: "Hot Monsters Beef (Free Ice Tea)", price: 35900, img: "Hotmonstersbeef.png", spicy: true, description: "Daging slice yang di-campur dengan Saos yang extra pedas dihidangkan bersama nasi putih hangat, telur mata sapi yang lezat, dan irisan timun serta tomat yang segar" },
            { name: "Special Monsters Beef (Free Ice Tea)", price: 35900, img: "Specialmonstersbeef.png", favorite: true, description: "Daging slice yang di-campur dengan Saos yang khas dan aromatik, dengan perpaduan asam, manis, & pedas yang seimbang dihidangkan bersama nasi putih hangat, telur mata sapi yang lezat, dan irisan timun serta tomat yang segar" },
            { name: "Honey Sauce Beef (Free Ice Tea)", price: 35900, img: "Honeysaucebeef.png", description: "Daging slice yang di-campur dengan Saos Madu yang manis dan lezat yang memiliki rasa khas, dihidangkan bersama nasi putih hangat, telur mata sapi yang lezat, dan irisan timun serta tomat yang segar," },
            { name: "Smoked Pepper Beef (Free Ice Tea)", price: 35900, img: "Smokedpepparbeef.png", description: "Daging slice yang di-campur dengan Saos Blackpapper yang lezat dan gurih, yang kaya akan rasa ladah hitam yang seimbang yang manis dan lezat yang memiliki rasa khas, dihidangkan bersama nasi putih hangat, telur mata sapi yang lezat, dan irisan timun serta tomat yang segar," },
            { name: "Hot Monsters Chicken (Free Ice Tea)", price: 26900, img: "Hotmonsterschicken.png", spicy: true, description: "Potongan Ayam crispy yang lezat dan renyah di padukan dengan saos yang extra pedas, dan sayuran segar, semua dalam satu piring. Disajikan dengan telur mata sapi dan nasi hangat" },
            { name: "Chicken Teriyaki (Free Ice Tea)", price: 26900, img: "Chickenteriyaki.png", favorite: true, description: "Potongan Ayam crispy yang lezat dan renyah di padukan dengan saos Teriyaki yang kaya rasa paduan manis dan gurih, dan sayuran segar, semua dalam satu piring. Disajikan dengan telur mata sapi dan nasi hangat" },
            { name: "Sweet & Sour Chicken (Free Ice Tea)", price: 26900, img: "Sweet&sourchiken.png", description: "Potongan Ayam crispy yang lezat dan renyah di padukan dengan rasa paduan asam dan manis, dan sayuran segar, semua dalam satu piring. Disajikan dengan telur mata sapi dan nasi hangat" },
            { name: "Javanesse Honey Spicy (Free Ice Tea)", price: 26900, img: "Javanessehoneyspicychicken.png", spicy: true, description: "Potongan Ayam crispy yang lezat dan renyah di padukan dengan saos jawa yang kaya rasa paduan pedas dan manis, dan sayuran segar, semua dalam satu piring. Disajikan dengan telur mata sapi dan nasi hangat" },
            { name: "Chicken Katsu (Free Ice Tea)", price: 28900, img: "Chikenkatsu.png", description: "Potongan Ayam katsu crispy yang lezat dan renyah di padukan dengan paduan rasa asam dan manis, dan sayuran segar, semua dalam satu piring. Disajikan dengan telur mata sapi dan nasi hangat" }
        ]
    },
    {
        category: "Mie",
        items: [
            { name: "Mie Hot Monsters", price: 20900, img: "miehotmonsters.png", favorite: true, spicy: true, description: "Sensasi pedas menggigit yang bikin nagih! Mie lembut berpadu dengan potongan ayam pedas berbumbu cabai khas Monster. Kuahnya gurih pedas, pas untuk pecinta tantangan. Pedasnya nampol, rasanya juara!" },
            { name: "Mie Ayam Monsters", price: 20900, img: "mieayammonsters.png", description: "Mie kenyal khas Monster dengan topping ayam berbumbu gurih-manis yang melimpah. Dimasak dengan racikan bumbu spesial rahasia Monster yang meresap sempurna ke dalam potongan ayam. Disajikan hangat dengan taburan bawang goreng dan sawi segar — klasik tapi dengan cita rasa luar biasa besar!" },
            { name: "Mie Ayam Jamur", price: 20900, img: "mieayamjamur.png", description: "Perpaduan sempurna antara ayam bumbu manis gurih dan jamur lembut yang juicy. Rasa gurih alami jamur menambah kedalaman cita rasa, menjadikan seporsi mie ini kaya tekstur dan aroma." },
            { name: "Mie Ayam Katsu", price: 22900, img: "mieayamkatsu.png", description: "Inovasi lezat dari dapur Monster! Mie kenyal disajikan dengan potongan ayam katsu renyah di luar, lembut di dalam. Disiram saus gurih dan bumbu khas yang bikin tiap gigitan terasa “crispy & creamy” sekaligus." },
            { name: "Mie Beef Monsters", price: 28900, img: "miebeefmonsters.png", description: "Nikmati kemewahan daging sapi empuk yang dimasak dengan bumbu spesial Monster. Kuah gurih dan aroma dagingnya menyatu sempurna dengan mie lembut. Cocok untuk kamu pencinta mie dengan cita rasa daging premium!" },
            { name: "Mie Polos", price: 9900, img: "miepolos.png", description: "Sajian sederhana tapi tetap istimewa. Mie kenyal tanpa topping, hanya diberi minyak ayam, kecap, dan bawang goreng yang harum. Cocok untuk anak-anak, atau buat kamu yang ingin rasa ringan tapi tetap nikmat." }
        ]
    },
    {
        category: "Minuman",
        items: [
            { name: "Ice Tea", price: 8900, img: "teh.png", description: "Teh dingin klasik yang menyegarkan! Rasa teh hitam yang pas, disajikan dingin dengan es batu yang bikin tenggorokan langsung segar di setiap tegukan." },
            { name: "Mineral Water", price: 8900, img: "mineralwater.png", description: "Kombinasi lembut antara teh harum dan susu creamy. Rasa manis gurihnya seimbang — cocok buat kamu yang suka sensasi lembut dan segar sekaligus." },
            { name: "Ice Tea Susu", price: 11700, img: "tehsusu.png", description: "Kombinasi lembut antara teh harum dan susu creamy. Rasa manis gurihnya seimbang — cocok buat kamu yang suka sensasi lembut dan segar sekaligus." },
            { name: "Ice Lemon Tea", price: 11700, img: "teh.png", description: "Teh dingin berpadu dengan segarnya perasan lemon asli. Rasa asam manisnya bikin semangat balik lagi, pas dinikmati kapan saja!" },
            { name: "Ice Chocolate", price: 11700, img: "coklat.png", description: "Minuman cokelat dingin yang creamy, manis pas, dan kaya rasa. Setiap tegukan menghadirkan sensasi cokelat yang lembut dan menenangkan." },
            { name: "Matcha Latte", price: 15000, img: "matcha.png", description: "Bubuk matcha premium dicampur dengan susu segar menciptakan rasa yang creamy dan sedikit pahit yang khas." },
            { name: "Coffe", price: 11700, img: "kopi.png", description: "Aroma kopi pekat yang menggoda dengan rasa pahit-gurih khas biji kopi pilihan. Cocok buat penambah energi dan semangat di tengah hari." },
            { name: "Coffe Cream", price: 14000, img: "kopisusu.png", description: "Kopi istimewa dengan tambahan krim lembut di atasnya. Rasa kopi yang kuat berpadu dengan tekstur creamy yang nikmat — cocok buat pecinta kopi manis lembut." }
        ]
    },
    {
        category: "Es Campur",
        items: [
            { name: "Es Campur 1 Porsi", price: 17900, img: "1.png", favorite: true, description: "Perpaduan segar berbagai isian seperti buah segar, jely kenyal, boba lembut, kacang merah, dan kacang hijau. Disajikan dengan es serut, sirup manis, dan susu kental yang creamy. Setiap sendoknya menghadirkan sensasi manis, segar, dan berwarna — nikmat banget untuk pengusir dahaga di hari panas!" },
            { name: "Es Campur 2 Porsi", price: 33000, img: "2.png", description: "Perpaduan segar berbagai isian seperti buah segar, jely kenyal, boba lembut, kacang merah, dan kacang hijau. Disajikan dengan es serut, sirup manis, dan susu kental yang creamy. Setiap sendoknya menghadirkan sensasi manis, segar, dan berwarna — nikmat banget untuk pengusir dahaga di hari panas!" },
            { name: "Es Campur 4 Porsi", price: 63900, img: "4.png", description: "Perpaduan segar berbagai isian seperti buah segar, jely kenyal, boba lembut, kacang merah, dan kacang hijau. Disajikan dengan es serut, sirup manis, dan susu kental yang creamy. Setiap sendoknya menghadirkan sensasi manis, segar, dan berwarna — nikmat banget untuk pengusir dahaga di hari panas!" },
            { name: "Es Campur 8 Porsi", price: 117900, img: "8.png", description: "Perpaduan segar berbagai isian seperti buah segar, jely kenyal, boba lembut, kacang merah, dan kacang hijau. Disajikan dengan es serut, sirup manis, dan susu kental yang creamy. Setiap sendoknya menghadirkan sensasi manis, segar, dan berwarna — nikmat banget untuk pengusir dahaga di hari panas!" },
            { name: "Es Campur 10 Porsi", price: 145800, img: "10.png", description: "Perpaduan segar berbagai isian seperti buah segar, jely kenyal, boba lembut, kacang merah, dan kacang hijau. Disajikan dengan es serut, sirup manis, dan susu kental yang creamy. Setiap sendoknya menghadirkan sensasi manis, segar, dan berwarna — nikmat banget untuk pengusir dahaga di hari panas!" },
            { name: "Es Campur 30 Porsi", price: 418500, img: "30.png", description: "Perpaduan segar berbagai isian seperti buah segar, jely kenyal, boba lembut, kacang merah, dan kacang hijau. Disajikan dengan es serut, sirup manis, dan susu kental yang creamy. Setiap sendoknya menghadirkan sensasi manis, segar, dan berwarna — nikmat banget untuk pengusir dahaga di hari panas!" }
        ]
    },
    {
        category: "Gorengan",
        items: [
            { name: "Ayam Gulung (6pcs)", price: 9900, img: "ayamgulung.png", favorite: true, description: "Adonan daging ayam pilihan digulung dan digoreng hingga renyah keemasan. Teksturnya lembut di dalam, gurih di luar — camilan favorit semua umur!" },
            { name: "Bakso Ayam (6pcs)", price: 9900, img: "baksoayam.png", description: "Bakso kenyal dari daging ayam segar, gurih dan juicy. Cocok disantap bersama mie atau jadi lauk tambahan yang bikin kenyang puas." },
            { name: "Tofu (6pcs)", price: 9900, img: "tofu.png", description: "Tahu lembut dengan rasa gurih khas, bisa digoreng renyah atau disajikan dengan saus pilihan. Camilan ringan tapi bikin nagih!" },
            { name: "Otak - Otak (6pcs)", price: 9900, img: "otakotak.png", description: "Olahan ikan berbumbu khas yang dipanggang atau digoreng hingga harum. Teksturnya kenyal gurih, makin lezat saat dicocol saus" },
            { name: "Scallop (6pcs)", price: 9900, img: "scalop.png", description: "Scallop goreng ini punya cita rasa khas laut yang ringan dan renyah" },
            { name: "Ikan Olahan Bintang (6pcs)", price: 9900, img: "bintang.png", description: "Pilihan olahan ikan berbentuk bintang yang lucu dan gurih. Renyah di luar, lembut di dalam — cocok jadi lauk tambahan atau camilan seru untuk anak-anak maupun dewasa." }
        ]
    }
];