< !DOCTYPE html >
  <html lang="vi">
    <head>
      <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Nest - Dashboard Admin</title>
          <script crossorigin src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
          <script crossorigin src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
          <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
          <script src="https://cdnjs.cloudflare.com/ajax/libs/Chart.js/3.9.1/chart.min.js"></script>
          <style>
            :root {
              --primary: #1eb988;
            --primary-hover: #19a876;
            --primary-active: #168668;
            --secondary: #f5f5f5;
            --text-primary: #133452;
            --text-secondary: #626c7c;
            --border-light: #e8e8e8;
            --success: #1eb988;
            --error: #ff5459;
            --warning: #e68161;
            --bg-primary: #fcfcf9;
            --bg-secondary: #ffffff;
            --danger: #c01530;
        }

            * {
              margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

            body {
              font - family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
            background-color: var(--bg-primary);
            color: var(--text-primary);
        }

            .container {
              display: flex;
            min-height: 100vh;
        }

            /* Sidebar */
            .sidebar {
              width: 180px;
            background-color: var(--bg-secondary);
            padding: 24px 16px;
            border-right: 1px solid var(--border-light);
        }

            .logo {
              display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 32px;
            font-size: 16px;
            font-weight: 600;
            color: var(--primary);
        }

            .nav-section {
              margin - bottom: 24px;
        }

            .nav-label {
              font - size: 12px;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            margin-bottom: 12px;
            padding-left: 12px;
        }

            .nav-item {
              padding: 10px 12px;
            border-radius: 8px;
            cursor: pointer;
            font-size: 14px;
            color: var(--text-secondary);
            transition: all 0.2s ease;
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 4px;
        }

            .nav-item.active {
              background - color: var(--primary);
            color: white;
            font-weight: 500;
        }

            .nav-item:hover:not(.active) {
              background - color: var(--secondary);
            color: var(--text-primary);
        }

            /* Main Content */
            .main-content {
              flex: 1;
            overflow-auto;
        }

            .topbar {
              display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 20px 40px;
            background-color: var(--bg-secondary);
            border-bottom: 1px solid var(--border-light);
            position: sticky;
            top: 0;
            z-index: 10;
        }

            .topbar-left {
              display: flex;
            align-items: center;
            gap: 16px;
        }

            .topbar-title {
              font - size: 24px;
            font-weight: 600;
            color: var(--text-primary);
        }

            .period-selector {
              display: flex;
            gap: 8px;
        }

            .period-dropdown {
              padding: 8px 16px;
            border: 1px solid var(--border-light);
            border-radius: 6px;
            background-color: var(--bg-secondary);
            color: var(--text-primary);
            font-size: 14px;
            cursor: pointer;
            transition: all 0.2s ease;
            appearance: none;
            background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23133452' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
            background-repeat: no-repeat;
            background-position: right 8px center;
            padding-right: 32px;
        }

            .period-dropdown:hover {
              border - color: var(--primary);
            background-color: #fcfcf9;
        }

            .period-dropdown:focus {
              outline: none;
            border-color: var(--primary);
            box-shadow: 0 0 0 3px rgba(30, 185, 136, 0.1);
        }

            .topbar-right {
              display: flex;
            align-items: center;
            gap: 16px;
        }

            .search-box {
              padding: 8px 16px;
            border: 1px solid var(--border-light);
            border-radius: 6px;
            background-color: #f9f9f9;
            font-size: 14px;
            width: 240px;
            color: var(--text-primary);
        }

            .search-box::placeholder {
              color: var(--text-secondary);
        }

            .search-box:focus {
              outline: none;
            border-color: var(--primary);
        }

            /* Content Area */
            .content {
              padding: 32px 40px;
        }

            .cards-grid {
              display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 20px;
            margin-bottom: 32px;
        }

            .card {
              background - color: var(--bg-secondary);
            border-radius: 12px;
            padding: 24px;
            border-left: 4px solid;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
            transition: all 0.2s ease;
        }

            .card:hover {
              box - shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

            .card.cyan {
              border - left - color: #32b8c6;
        }

            .card.blue {
              border - left - color: #3b82f6;
        }

            .card.purple {
              border - left - color: #a855f7;
        }

            .card.orange {
              border - left - color: #e6816f;
        }

            .card-header {
              display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 16px;
        }

            .card-label {
              font - size: 12px;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
        }

            .card-icon {
              width: 40px;
            height: 40px;
            border-radius: 8px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 20px;
        }

            .card.cyan .card-icon {
              background - color: rgba(50, 184, 198, 0.1);
        }

            .card.blue .card-icon {
              background - color: rgba(59, 130, 246, 0.1);
        }

            .card.purple .card-icon {
              background - color: rgba(168, 85, 247, 0.1);
        }

            .card.orange .card-icon {
              background - color: rgba(230, 129, 97, 0.1);
        }

            .card-value {
              font - size: 32px;
            font-weight: 600;
            color: var(--text-primary);
            margin-bottom: 12px;
        }

            .card-change {
              font - size: 12px;
            font-weight: 500;
            display: flex;
            align-items: center;
            gap: 4px;
        }

            .change-down {
              color: var(--danger);
        }

            .change-up {
              color: var(--success);
        }

            /* Charts Grid */
            .charts-grid {
              display: grid;
            grid-template-columns: 1.5fr 1fr;
            gap: 20px;
            margin-bottom: 32px;
        }

            .chart-card {
              background - color: var(--bg-secondary);
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

            .chart-card:hover {
              box - shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
        }

            .chart-header {
              display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

            .chart-title {
              font - size: 16px;
            font-weight: 600;
            color: var(--text-primary);
        }

            .chart-legend {
              display: flex;
            gap: 16px;
            font-size: 12px;
        }

            .legend-item {
              display: flex;
            align-items: center;
            gap: 6px;
        }

            .legend-dot {
              width: 8px;
            height: 8px;
            border-radius: 50%;
        }

            .legend-dot.current {
              background - color: #1eb988;
        }

            .legend-dot.previous {
              background - color: #e68161;
        }

            .chart-container {
              position: relative;
            height: 300px;
        }

            /* Transactions Table */
            .transactions-card {
              background - color: var(--bg-secondary);
            border-radius: 12px;
            padding: 24px;
            box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
        }

            .transactions-header {
              display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 20px;
        }

            .transactions-title {
              font - size: 16px;
            font-weight: 600;
            color: var(--text-primary);
            display: flex;
            align-items: center;
            gap: 8px;
        }

            .badge {
              background - color: var(--primary);
            color: white;
            border-radius: 12px;
            padding: 2px 8px;
            font-size: 12px;
            font-weight: 600;
        }

            table {
              width: 100%;
            border-collapse: collapse;
        }

            thead {
              border - bottom: 1px solid var(--border-light);
        }

            th {
              text - align: left;
            padding: 12px 0;
            font-size: 12px;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
        }

            td {
              padding: 16px 0;
            font-size: 14px;
            border-bottom: 1px solid var(--border-light);
            color: var(--text-primary);
        }

            .order-id {
              font - weight: 600;
            color: #3b82f6;
        }

            .status {
              display: inline-block;
            padding: 4px 12px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 600;
        }

            .status.delivered {
              background - color: rgba(30, 185, 136, 0.15);
            color: var(--success);
        }

            .status.pending {
              background - color: rgba(230, 129, 97, 0.15);
            color: var(--warning);
        }

            .status.cancelled {
              background - color: rgba(192, 21, 47, 0.15);
            color: var(--danger);
        }

            /* Responsive */
            @media (max-width: 1024px) {
            .charts - grid {
              grid - template - columns: 1fr;
            }

            .sidebar {
              width: 80px;
            }

            .topbar {
              padding: 16px 24px;
            }

            .content {
              padding: 24px;
            }
        }

            @media (max-width: 768px) {
            .container {
              flex - direction: column;
            }

            .sidebar {
              width: 100%;
            padding: 16px;
            display: flex;
            gap: 16px;
            align-items: center;
            border-right: none;
            border-bottom: 1px solid var(--border-light);
            }

            .nav-section {
              display: flex;
            gap: 8px;
            margin: 0;
            }

            .cards-grid {
              grid - template - columns: 1fr;
            }

            .topbar {
              flex - direction: column;
            gap: 16px;
            align-items: flex-start;
            }

            .topbar-right {
              width: 100%;
            justify-content: flex-end;
            }

            .search-box {
              width: 100%;
            }
        }
          </style>
        </head>
        <body>
          <div id="root"></div>

          <script type="text/babel">
            const {useState, useEffect, useRef} = React;

            // Mock Data
            const mockData = {
              'this-week': {
              totalOrders: 7,
            totalSales: 17,
            newCustomers: 0,
            totalRevenue: 716520,
            orderTrend: {
              labels: ['Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7', 'CN'],
            current: [200000, 150000, 180000, 220000, 280000, 320000, 150000],
            previous: [180000, 160000, 170000, 200000, 190000, 250000, 140000]
                },
            topCategories: [
            {name: 'Canned Food', value: 35, color: '#e6816f' },
            {name: 'Drink', value: 25, color: '#3b82f6' },
            {name: 'Fresh', value: 30, color: '#fbbf24' },
            {name: 'Snack', value: 10, color: '#a855f7' }
            ],
            transactions: [
            {id: 'ORD25120000015', customer: 'Trần Tú', phone: '0123452222', amount: 49170, date: '08/12/2025', status: 'delivered' },
            {id: 'ORD25120000013', customer: 'Trần Tú', phone: '0123451111', amount: 441600, date: '08/12/2025', status: 'delivered' },
            {id: 'ORD25120000012', customer: 'Nguyễn Văn A', phone: '0987654321', amount: 225750, date: '07/12/2025', status: 'pending' },
            {id: 'ORD25120000011', customer: 'Phạm Thị B', phone: '0912345678', amount: 876000, date: '07/12/2025', status: 'delivered' },
            {id: 'ORD25120000010', customer: 'Lê Văn C', phone: '0938282828', amount: 325000, date: '06/12/2025', status: 'cancelled' }
            ]
            },
            'this-month': {
              totalOrders: 42,
            totalSales: 156,
            newCustomers: 18,
            totalRevenue: 8924800,
            orderTrend: {
              labels: ['12/01', '12/05', '12/08', '12/12', '12/15', '12/18', '12/22', '12/25', '12/28'],
            current: [450000, 520000, 680000, 720000, 890000, 750000, 920000, 850000, 680000],
            previous: [380000, 420000, 550000, 620000, 700000, 680000, 780000, 820000, 620000]
                },
            topCategories: [
            {name: 'Canned Food', value: 28, color: '#e6816f' },
            {name: 'Drink', value: 32, color: '#3b82f6' },
            {name: 'Fresh', value: 26, color: '#fbbf24' },
            {name: 'Snack', value: 14, color: '#a855f7' }
            ],
            transactions: [
            {id: 'ORD25120000015', customer: 'Trần Tú', phone: '0123452222', amount: 49170, date: '08/12/2025', status: 'delivered' },
            {id: 'ORD25120000013', customer: 'Trần Tú', phone: '0123451111', amount: 441600, date: '08/12/2025', status: 'delivered' },
            {id: 'ORD25120000012', customer: 'Nguyễn Văn A', phone: '0987654321', amount: 225750, date: '07/12/2025', status: 'pending' },
            {id: 'ORD25120000011', customer: 'Phạm Thị B', phone: '0912345678', amount: 876000, date: '07/12/2025', status: 'delivered' },
            {id: 'ORD25120000010', customer: 'Lê Văn C', phone: '0938282828', amount: 325000, date: '06/12/2025', status: 'cancelled' }
            ]
            },
            'this-year': {
              totalOrders: 287,
            totalSales: 1203,
            newCustomers: 125,
            totalRevenue: 52348000,
            orderTrend: {
              labels: ['Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6', 'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'],
            current: [3200000, 3450000, 3980000, 4200000, 4800000, 4500000, 5200000, 4950000, 5100000, 5400000, 5680000, 6100000],
            previous: [2800000, 3100000, 3500000, 3800000, 4200000, 4000000, 4600000, 4400000, 4800000, 5000000, 5200000, 5600000]
                },
            topCategories: [
            {name: 'Canned Food', value: 24, color: '#e6816f' },
            {name: 'Drink', value: 30, color: '#3b82f6' },
            {name: 'Fresh', value: 32, color: '#fbbf24' },
            {name: 'Snack', value: 14, color: '#a855f7' }
            ],
            transactions: [
            {id: 'ORD25120000015', customer: 'Trần Tú', phone: '0123452222', amount: 49170, date: '08/12/2025', status: 'delivered' },
            {id: 'ORD25120000013', customer: 'Trần Tú', phone: '0123451111', amount: 441600, date: '08/12/2025', status: 'delivered' },
            {id: 'ORD25120000012', customer: 'Nguyễn Văn A', phone: '0987654321', amount: 225750, date: '07/12/2025', status: 'pending' },
            {id: 'ORD25120000011', customer: 'Phạm Thị B', phone: '0912345678', amount: 876000, date: '07/12/2025', status: 'delivered' },
            {id: 'ORD25120000010', customer: 'Lê Văn C', phone: '0938282828', amount: 325000, date: '06/12/2025', status: 'cancelled' }
            ]
            }
        };

        // Format Currency
        const formatCurrency = (value) => {
            return new Intl.NumberFormat('vi-VN', {
              style: 'currency',
            currency: 'VND',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0
            }).format(value);
        };

            // Summary Card Component
            function SummaryCard({label, value, change, icon, color, isRevenue = false}) {
            const isNegative = change < 0;
            return (
            <div className={`card ${color}`}>
              <div className="card-header">
                <div className="card-label">{label}</div>
                <div className="card-icon">{icon}</div>
              </div>
              <div className="card-value">
                {isRevenue ? formatCurrency(value) : value}
              </div>
              <div className={`card-change ${isNegative ? 'change-down' : 'change-up'}`}>
                <span>↓ {Math.abs(change)}%</span>
                <span>so với kỳ trước</span>
              </div>
            </div>
            );
        }

            // Order Trend Chart
            function OrderTrendChart({data}) {
            const canvasRef = useRef(null);
            const chartRef = useRef(null);

            useEffect(() => {
                if (!canvasRef.current) return;

            if (chartRef.current) {
              chartRef.current.destroy();
                }

            const ctx = canvasRef.current.getContext('2d');
            chartRef.current = new Chart(ctx, {
              type: 'line',
            data: {
              labels: data.labels,
            datasets: [
            {
              label: 'Tháng này',
            data: data.current,
            borderColor: '#1eb988',
            backgroundColor: 'rgba(30, 185, 136, 0.05)',
            borderWidth: 2,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#1eb988',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            tension: 0.4
                            },
            {
              label: 'Tháng trước',
            data: data.previous,
            borderColor: '#e68161',
            backgroundColor: 'rgba(230, 129, 97, 0.05)',
            borderWidth: 2,
            fill: true,
            pointRadius: 4,
            pointBackgroundColor: '#e68161',
            pointBorderColor: '#fff',
            pointBorderWidth: 2,
            tension: 0.4
                            }
            ]
                    },
            options: {
              responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
              display: false
                            }
                        },
            scales: {
              y: {
              beginAtZero: true,
            ticks: {
              callback: function(value) {
                                        return '₫' + (value / 1000000).toFixed(0) + 'M';
                                    },
            color: '#626c7c',
            font: {
              size: 12
                                    }
                                },
            border: {
              display: false
                                },
            grid: {
              color: 'rgba(0, 0, 0, 0.05)'
                                }
                            },
            x: {
              ticks: {
              color: '#626c7c',
            font: {
              size: 12
                                    }
                                },
            border: {
              display: false
                                },
            grid: {
              display: false
                                }
                            }
                        }
                    }
                });

                return () => {
                    if (chartRef.current) {
              chartRef.current.destroy();
                    }
                };
            }, [data]);

            return (
            <div className="chart-card">
              <div className="chart-header">
                <div className="chart-title">Xu hướng đơn hàng</div>
                <div className="chart-legend">
                  <div className="legend-item">
                    <div className="legend-dot current"></div>
                    <span>Tháng này</span>
                  </div>
                  <div className="legend-item">
                    <div className="legend-dot previous"></div>
                    <span>Tháng trước</span>
                  </div>
                </div>
              </div>
              <div className="chart-container">
                <canvas ref={canvasRef}></canvas>
              </div>
            </div>
            );
        }

            // Top Categories Chart (Pie Chart)
            function TopCategoriesChart({data}) {
            const canvasRef = useRef(null);
            const chartRef = useRef(null);

            useEffect(() => {
                if (!canvasRef.current) return;

            if (chartRef.current) {
              chartRef.current.destroy();
                }

            const ctx = canvasRef.current.getContext('2d');
            chartRef.current = new Chart(ctx, {
              type: 'doughnut',
            data: {
              labels: data.map(cat => cat.name),
            datasets: [{
              data: data.map(cat => cat.value),
                            backgroundColor: data.map(cat => cat.color),
            borderWidth: 2,
            borderColor: '#ffffff'
                        }]
                    },
            options: {
              responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: {
              display: true,
            position: 'bottom',
            labels: {
              padding: 16,
            font: {
              size: 12,
            weight: 500
                                    },
            color: '#626c7c',
            usePointStyle: true,
            pointStyle: 'circle'
                                }
                            }
                        }
                    }
                });

                return () => {
                    if (chartRef.current) {
              chartRef.current.destroy();
                    }
                };
            }, [data]);

            return (
            <div className="chart-card">
              <div className="chart-header">
                <div className="chart-title">Danh mục bán chạy</div>
              </div>
              <div className="chart-container">
                <canvas ref={canvasRef}></canvas>
              </div>
            </div>
            );
        }

            // Recent Transactions Component
            function RecentTransactions({transactions}) {
            return (
            <div className="transactions-card">
              <div className="transactions-header">
                <div className="transactions-title">
                  <span>⏱️</span>
                  Giao dịch gần đây
                  <span className="badge">{transactions.length}</span>
                </div>
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Mã đơn hàng</th>
                    <th>Tên khách hàng</th>
                    <th>Số điện thoại</th>
                    <th>Tổng thanh toán</th>
                    <th>Ngày</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map(txn => (
                    <tr key={txn.id}>
                      <td className="order-id">{txn.id}</td>
                      <td>{txn.customer}</td>
                      <td>{txn.phone}</td>
                      <td>{formatCurrency(txn.amount)}</td>
                      <td>{txn.date}</td>
                      <td>
                        <span className={`status ${txn.status}`}>
                          {txn.status === 'delivered' && 'Đã giao'}
                          {txn.status === 'pending' && 'Chờ xử lý'}
                          {txn.status === 'cancelled' && 'Đã hủy'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            );
        }

            // Main Dashboard Component
            function Dashboard() {
            const [period, setPeriod] = useState('this-month');
            const [data, setData] = useState(mockData['this-month']);

            const handlePeriodChange = (e) => {
                const selectedPeriod = e.target.value;
            setPeriod(selectedPeriod);
            setData(mockData[selectedPeriod]);
            };

            return (
            <div className="container">
              {/* Sidebar */}
              <aside className="sidebar">
                <div className="logo">
                  🏠 Nest
                </div>
                <div className="nav-section">
                  <div className="nav-label">Menu</div>
                  <div className="nav-item active">📊 Dashboard</div>
                  <div className="nav-item">📦 Đơn hàng</div>
                  <div className="nav-item">📂 Danh mục</div>
                  <div className="nav-item">🛍️ Sản phẩm</div>
                </div>
                <div className="nav-section">
                  <div className="nav-label">Khác</div>
                  <div className="nav-item">👥 Khách hàng</div>
                  <div className="nav-item">🚚 Nhà cung cấp</div>
                  <div className="nav-item">💳 Thanh toán</div>
                </div>
              </aside>

              {/* Main Content */}
              <div className="main-content">
                {/* Topbar */}
                <div className="topbar">
                  <div className="topbar-left">
                    <div className="topbar-title">Dashboard</div>
                  </div>
                  <div className="topbar-right">
                    <div className="period-selector">
                      <select
                        className="period-dropdown"
                        value={period}
                        onChange={handlePeriodChange}
                      >
                        <option value="this-week">Tuần này</option>
                        <option value="this-month">Tháng này</option>
                        <option value="this-year">Năm này</option>
                      </select>
                    </div>
                    <input
                      type="text"
                      className="search-box"
                      placeholder="Tìm kiếm..."
                    />
                  </div>
                </div>

                {/* Content */}
                <div className="content">
                  {/* Summary Cards */}
                  <div className="cards-grid">
                    <SummaryCard
                      label="Tổng đơn hàng"
                      value={data.totalOrders}
                      change={68.2}
                      icon="📊"
                      color="cyan"
                    />
                    <SummaryCard
                      label="Tổng doanh số"
                      value={data.totalSales}
                      change={74.6}
                      icon="💳"
                      color="blue"
                    />
                    <SummaryCard
                      label="Khách hàng mới"
                      value={data.newCustomers}
                      change={100}
                      icon="👥"
                      color="purple"
                    />
                    <SummaryCard
                      label="Tổng doanh thu"
                      value={data.totalRevenue}
                      change={77.2}
                      icon="📈"
                      color="orange"
                      isRevenue={true}
                    />
                  </div>

                  {/* Charts */}
                  <div className="charts-grid">
                    <OrderTrendChart data={data.orderTrend} />
                    <TopCategoriesChart data={data.topCategories} />
                  </div>

                  {/* Transactions */}
                  <RecentTransactions transactions={data.transactions} />
                </div>
              </div>
            </div>
            );
        }

            ReactDOM.createRoot(document.getElementById('root')).render(
            <Dashboard />
            );
          </script>
        </body>
      </html>