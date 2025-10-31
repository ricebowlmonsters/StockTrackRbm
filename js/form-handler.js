// Form handler utilities for input.html
async function validateFormData(formData) {
    const transactionType = formData.get('transactionType');
    const date = formData.get('transactionDate');
    const customerName = formData.get('customerName');
    
    if (!transactionType || !date) {
        throw new Error('Pilih jenis transaksi dan tanggal!');
    }

    if (transactionType === 'out' && !customerName) {
        throw new Error('Pilih nama pelanggan untuk transaksi keluar!');
    }

    return true;
}

async function processItemData(formData, transactionType) {
    const items = [];
    // Selector yang lebih spesifik untuk setiap jenis baris
    const itemRows = document.querySelectorAll(`#${transactionType}ItemsList .${transactionType}-item-row`);

    for (const row of itemRows) {
        // Menggunakan selector class yang lebih spesifik untuk setiap jenis transaksi
        const name = row.querySelector(`.item-name-${transactionType}`)?.value;
        const quantity = parseFloat(row.querySelector(`.item-quantity-${transactionType}`)?.value);
        const unit = row.querySelector(`.item-unit-${transactionType}`)?.value;
        
        if (!name || !quantity || !unit) {
            throw new Error(`Data item tidak lengkap: ${name}`);
        }

        items.push({
            name,
            quantity,
            unit,
            date: formData.get('transactionDate'),
            transactionType,
            description: formData.get('itemDescription') || ''
        });
    }

    return items;
}

async function saveItemsToFirestore(items) {
    const batch = db.batch();
    
    for (const item of items) {
        const docRef = db.collection('items').doc();
        batch.set(docRef, {
            ...item,
            id: docRef.id,
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    await batch.commit();
    return items;
}

async function updateStock(items) {
    const batch = db.batch();
    
    for (const item of items) {
        const stockRef = db.collection('stock').doc(item.name);
        batch.set(stockRef, {
            name: item.name,
            unit: item.unit,
            lastUpdated: firebase.firestore.FieldValue.serverTimestamp(),
            quantity: firebase.firestore.FieldValue.increment(
                item.transactionType === 'in' ? item.quantity : -item.quantity
            )
        }, { merge: true });
    }

    await batch.commit();
}

async function addTransactionActivity(items, transactionType) {
    const activity = {
        id: 'ACT-' + Date.now(),
        date: items[0].date,
        type: transactionType,
        description: items.map(item => 
            `${item.name}: ${item.quantity} ${item.unit}`
        ).join(', '),
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('activities').doc(activity.id).set(activity);
}

async function handleTransactionSubmit(e) {
    e.preventDefault();
    showLoadingSpinner();

    try {
        const form = e.target;
        const formData = new FormData(form);
        
        // Validate form data
        await validateFormData(formData);
        
        // Process items based on transaction type
        const transactionType = formData.get('transactionType');
        if (!transactionType) {
            throw new Error("Jenis transaksi belum dipilih.");
        }

        const items = await processItemData(formData, transactionType);
        
        if (items.length === 0) {
            throw new Error("Tidak ada item yang ditambahkan untuk transaksi ini.");
        }

        // Save items using batch write
        await saveItemsToFirestore(items);
        
        // Update stock levels
        await updateStock(items);
        
        // Record activity
        await addTransactionActivity(items, transactionType);

        // Clear form and show success message
        form.reset();
        // Set tanggal kembali ke hari ini setelah reset
        document.getElementById('transactionDate').value = new Date().toISOString().split('T')[0];
        hideLoadingSpinner();
        showAlert('Data berhasil disimpan!');
        
    } catch (error) {
        hideLoadingSpinner();
        showAlert('Error: ' + error.message, 'Gagal');
        console.error('Error submitting form:', error);
    }
}