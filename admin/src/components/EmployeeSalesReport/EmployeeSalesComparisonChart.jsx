import React, { useEffect, useRef } from 'react';
import { Users } from 'lucide-react';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export const EmployeeSalesComparisonChart = ({ employees = [] }) => {
  const canvasRef = useRef(null);
  const chartRef = useRef(null);

  useEffect(() => {
    if (!canvasRef.current || !employees || employees.length === 0) return;

    if (chartRef.current) {
      chartRef.current.destroy();
    }

    // Take top 10 employees by revenue
    const topEmployees = employees.slice(0, 10);

    const ctx = canvasRef.current.getContext('2d');
    chartRef.current = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: topEmployees.map(e => e.employeeCode),
        datasets: [
          {
            label: 'Revenue',
            data: topEmployees.map(e => e.totalRevenue),
            backgroundColor: 'rgba(59, 130, 246, 0.8)',
            borderColor: 'rgb(59, 130, 246)',
            borderWidth: 1
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            padding: 12,
            titleFont: { size: 13, weight: 'bold' },
            bodyFont: { size: 12 },
            callbacks: {
              title: function (context) {
                const index = context[0].dataIndex;
                const employee = topEmployees[index];
                return employee.employeeName + ' (' + employee.employeeCode + ')';
              },
              label: function (context) {
                const value = context.parsed.y;
                return 'Revenue: ' + new Intl.NumberFormat('vi-VN', {
                  style: 'currency',
                  currency: 'VND',
                  minimumFractionDigits: 0
                }).format(value);
              },
              afterLabel: function (context) {
                const index = context.dataIndex;
                const employee = topEmployees[index];
                return [
                  'Orders: ' + employee.totalOrders.toLocaleString(),
                  'Items Sold: ' + employee.totalQuantity.toLocaleString()
                ];
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function (value) {
                if (value >= 1000000) {
                  return '₫' + (value / 1000000).toFixed(1) + 'M';
                } else if (value >= 1000) {
                  return '₫' + (value / 1000).toFixed(0) + 'K';
                }
                return '₫' + value;
              },
              color: '#626c7c',
              font: { size: 12 }
            },
            border: { display: false },
            grid: { color: 'rgba(0, 0, 0, 0.05)' }
          },
          x: {
            ticks: {
              color: '#626c7c',
              font: { size: 12 }
            },
            border: { display: false },
            grid: { display: false }
          }
        }
      }
    });

    return () => {
      if (chartRef.current) {
        chartRef.current.destroy();
      }
    };
  }, [employees]);

  if (!employees || employees.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm p-8 text-center">
        <p className="text-gray-500 text-sm">No employee data available</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-base font-semibold text-gray-900 flex items-center gap-2">
            <Users className="w-5 h-5 text-blue-600" />
            Employee Revenue Comparison
          </h3>
          <p className="text-xs text-gray-600 mt-1">Top {Math.min(10, employees.length)} employees by revenue</p>
        </div>
      </div>

      <div className="relative h-80">
        <canvas ref={canvasRef}></canvas>
      </div>
    </div>
  );
};
