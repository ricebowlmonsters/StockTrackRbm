// Monitoring Page JavaScript

function initializeMonitoringPage() {
    // Set default to last 7 days
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 7);
    
    // Set the date inputs
    document.getElementById('startDate').value = formatDateForInput(startDate);
    document.getElementById('endDate').value = formatDateForInput(endDate);
    
    // Initialize info cards with 0
    document.getElementById('totalAllOutlets').textContent = 'Rp 0';
    document.getElementById('totalPonti').textContent = 'Rp 0';
    document.getElementById('totalDarmokali').textContent = 'Rp 0';
    document.getElementById('totalTrosobo').textContent = 'Rp 0';
    
    // Initialize charts
    updateCharts();
    
    // Event listeners
    document.getElementById('filterBtn').addEventListener('click', updateCharts);
    document.getElementById('last7DaysBtn').addEventListener('click', function() {
        const end = new Date();
        const start = new Date();
        start.setDate(start.getDate() - 7);
        document.getElementById('startDate').value = formatDateForInput(start);
        document.getElementById('endDate').value = formatDateForInput(end);
        updateCharts();
    });
}

function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function updateCharts() {
    const startDate = document.getElementById('startDate').value;
    const endDate = document.getElementById('endDate').value;
    
    // Filter items for date range and out transactions
    const filteredItems = items.filter(item => {
        if (item.transactionType !== 'out') return false;
        if (!item.date) return false;
        const itemDate = new Date(item.date);
        const start = new Date(startDate);
        const end = new Date(endDate);
        return itemDate >= start && itemDate <= end;
    });
    
    // Create chart data
    const salesByOutlet = getSalesByOutlet(filteredItems, startDate, endDate);
    const monthlyData = getMonthlySales(filteredItems);
    const outletMonthlyData = getOutletMonthlySales(filteredItems);
    
    // Update info cards
    updateInfoCards(salesByOutlet, monthlyData);
    
    // Update charts
    updateSalesChart(salesByOutlet);
    updateMonthlyChart(monthlyData);
    updateOutletMonthlyChart(outletMonthlyData);
}

function getSalesByOutlet(items, startDate, endDate) {
    const outlets = ['RBM PONTI', 'RBM DARMOKALI', 'RBM TROSOBO'];
    const data = {};
    
    outlets.forEach(outlet => {
        data[outlet] = {};
    });
    
    // Get all dates in range
    const dates = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dates.push(formatDateForInput(d));
    }
    
    // Initialize with zeros
    dates.forEach(date => {
        outlets.forEach(outlet => {
            if (!data[outlet][date]) {
                data[outlet][date] = 0;
            }
        });
    });
    
    // Calculate sales
    items.forEach(item => {
        const date = item.date;
        const outlet = item.customerName;
        if (outlets.includes(outlet)) {
            const totalPrice = (item.price || 0) * (item.quantity || 0);
            if (!data[outlet][date]) {
                data[outlet][date] = 0;
            }
            data[outlet][date] += totalPrice;
        }
    });
    
    return data;
}

function getMonthlySales(items) {
    const monthlyData = {};
    
    items.forEach(item => {
        const date = new Date(item.date);
        const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const totalPrice = (item.price || 0) * (item.quantity || 0);
        
        if (!monthlyData[yearMonth]) {
            monthlyData[yearMonth] = 0;
        }
        monthlyData[yearMonth] += totalPrice;
    });
    
    return monthlyData;
}

function getOutletMonthlySales(items) {
    const outlets = ['RBM PONTI', 'RBM DARMOKALI', 'RBM TROSOBO'];
    const data = {};
    
    outlets.forEach(outlet => {
        data[outlet] = {};
    });
    
    items.forEach(item => {
        const outlet = item.customerName;
        if (outlets.includes(outlet)) {
            const date = new Date(item.date);
            const yearMonth = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            const totalPrice = (item.price || 0) * (item.quantity || 0);
            
            if (!data[outlet][yearMonth]) {
                data[outlet][yearMonth] = 0;
            }
            data[outlet][yearMonth] += totalPrice;
        }
    });
    
    return data;
}

function updateInfoCards(salesByOutlet, monthlyData) {
    // Calculate totals
    let totalAll = 0;
    let totalPonti = 0;
    let totalDarmokali = 0;
    let totalTrosobo = 0;
    
    // Sum from the filtered date range
    Object.entries(salesByOutlet).forEach(([outlet, data]) => {
        const total = Object.values(data).reduce((sum, val) => sum + val, 0);
        
        switch(outlet) {
            case 'RBM PONTI':
                totalPonti = total;
                break;
            case 'RBM DARMOKALI':
                totalDarmokali = total;
                break;
            case 'RBM TROSOBO':
                totalTrosobo = total;
                break;
        }
    });
    
    // Calculate total all outlets
    totalAll = totalPonti + totalDarmokali + totalTrosobo;
    
    // Update the display with animations
    animateValue('totalAllOutlets', totalAll);
    animateValue('totalPonti', totalPonti);
    animateValue('totalDarmokali', totalDarmokali);
    animateValue('totalTrosobo', totalTrosobo);
}

// Function to animate value changes
function animateValue(elementId, value) {
    const element = document.getElementById(elementId);
    const start = parseInt(element.textContent.replace(/[^0-9]/g, '')) || 0;
    const duration = 1000; // 1 second animation
    const steps = 20;
    const increment = (value - start) / steps;
    let current = start;
    let step = 0;
    
    const timer = setInterval(() => {
        step++;
        current += increment;
        element.textContent = formatCurrency(Math.round(current));
        
        if (step >= steps) {
            clearInterval(timer);
            element.textContent = formatCurrency(value); // Ensure final value is exact
        }
    }, duration / steps);
}

function updateSalesChart(data) {
    const ctx = document.getElementById('salesChart7Days');
    
    // Show loading state
    if (ctx.parentElement) {
        ctx.parentElement.style.position = 'relative';
        const loadingDiv = document.createElement('div');
        loadingDiv.className = 'chart-loading';
        loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memuat data...';
        loadingDiv.style.position = 'absolute';
        loadingDiv.style.top = '50%';
        loadingDiv.style.left = '50%';
        loadingDiv.style.transform = 'translate(-50%, -50%)';
        ctx.parentElement.appendChild(loadingDiv);
    }
    
    // Destroy existing chart if exists
    if (window.salesChartInstance) {
        window.salesChartInstance.destroy();
    }
    
    const dates = Object.keys(data['RBM PONTI'] || data['RBM DARMOKALI'] || data['RBM TROSOBO'] || []);
    const dateLabels = dates.map(date => {
        const d = new Date(date);
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    });
    
    const pontiData = dates.map(date => data['RBM PONTI']?.[date] || 0);
    const darmokaliData = dates.map(date => data['RBM DARMOKALI']?.[date] || 0);
    const trosoboData = dates.map(date => data['RBM TROSOBO']?.[date] || 0);
    
    window.salesChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dateLabels,
            datasets: [
                {
                    label: 'RBM PONTI',
                    data: pontiData,
                    borderColor: 'rgb(118, 75, 162)',
                    backgroundColor: 'rgba(118, 75, 162, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'RBM DARMOKALI',
                    data: darmokaliData,
                    borderColor: 'rgb(4, 172, 254)',
                    backgroundColor: 'rgba(4, 172, 254, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'RBM TROSOBO',
                    data: trosoboData,
                    borderColor: 'rgb(67, 233, 123)',
                    backgroundColor: 'rgba(67, 233, 123, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                title: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

function updateMonthlyChart(monthlyData) {
    const ctx = document.getElementById('totalSalesMonthlyChart');
    
    // Destroy existing chart if exists
    if (window.monthlyChartInstance) {
        window.monthlyChartInstance.destroy();
    }
    
    const months = Object.keys(monthlyData).sort();
    const values = months.map(month => monthlyData[month]);
    const labels = months.map(month => {
        const [year, monthNum] = month.split('-');
        const date = new Date(year, monthNum - 1);
        return date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    });
    
    window.monthlyChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total Penjualan',
                data: values,
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'Total: ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

function updateOutletMonthlyChart(data) {
    const ctx = document.getElementById('outletMonthlyChart');
    
    // Destroy existing chart if exists
    if (window.outletMonthlyChartInstance) {
        window.outletMonthlyChartInstance.destroy();
    }
    
    // Get all unique months from all outlets
    const allMonths = new Set();
    Object.keys(data).forEach(outlet => {
        Object.keys(data[outlet]).forEach(month => allMonths.add(month));
    });
    const months = Array.from(allMonths).sort();
    
    const labels = months.map(month => {
        const [year, monthNum] = month.split('-');
        const date = new Date(year, monthNum - 1);
        return date.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
    });
    
    const pontiData = months.map(month => data['RBM PONTI']?.[month] || 0);
    const darmokaliData = months.map(month => data['RBM DARMOKALI']?.[month] || 0);
    const trosoboData = months.map(month => data['RBM TROSOBO']?.[month] || 0);
    
    window.outletMonthlyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'RBM PONTI',
                    data: pontiData,
                    borderColor: 'rgb(118, 75, 162)',
                    backgroundColor: 'rgba(118, 75, 162, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'RBM DARMOKALI',
                    data: darmokaliData,
                    borderColor: 'rgb(4, 172, 254)',
                    backgroundColor: 'rgba(4, 172, 254, 0.1)',
                    tension: 0.4,
                    fill: true
                },
                {
                    label: 'RBM TROSOBO',
                    data: trosoboData,
                    borderColor: 'rgb(67, 233, 123)',
                    backgroundColor: 'rgba(67, 233, 123, 0.1)',
                    tension: 0.4,
                    fill: true
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return context.dataset.label + ': ' + formatCurrency(context.parsed.y);
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

function formatCurrency(value) {
    return 'Rp ' + value.toLocaleString('id-ID');
}

// Function to process transactions more efficiently
function processTransactions(items, startDate, endDate) {
    return items.filter(item => {
        const itemDate = new Date(item.date);
        return itemDate >= startDate && itemDate <= endDate;
    }).reduce((acc, item) => {
        const outlet = item.customerName;
        if (!acc[outlet]) {
            acc[outlet] = {
                total: 0,
                dailyTotals: {}
            };
        }
        
        const amount = item.price * item.quantity;
        acc[outlet].total += amount;
        
        const dateStr = item.date;
        if (!acc[outlet].dailyTotals[dateStr]) {
            acc[outlet].dailyTotals[dateStr] = 0;
        }
        acc[outlet].dailyTotals[dateStr] += amount;
        
        return acc;
    }, {});
}

// Enhanced error handling
function handleError(error, context) {
    console.error(`Error in ${context}:`, error);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'alert alert-danger';
    errorDiv.innerHTML = `
        <i class="fas fa-exclamation-triangle"></i>
        Terjadi kesalahan saat memuat data. Silakan coba lagi.
    `;
    document.querySelector('.main-content').insertBefore(
        errorDiv,
        document.querySelector('.main-content').firstChild
    );
    setTimeout(() => errorDiv.remove(), 5000);
}

// Set chart container heights and initialize responsive behavior
window.addEventListener('load', function() {
    const charts = document.querySelectorAll('.chart-container');
    charts.forEach(chart => {
        const canvas = chart.querySelector('canvas');
        if (canvas) {
            canvas.style.maxHeight = '400px';
            canvas.style.width = '100%';
        }
    });
    
    // Add resize handler for responsive charts
    let resizeTimeout;
    window.addEventListener('resize', function() {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
            updateCharts();
        }, 250);
    });
});
