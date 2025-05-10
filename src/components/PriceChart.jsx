import React, { useRef, useEffect } from 'react';
import './PriceChart.css';

const PriceChart = ({ priceHistory, feedName }) => {
  const canvasRef = useRef(null);
  
  useEffect(() => {
    if (!priceHistory || priceHistory.length < 2 || !canvasRef.current) {
      return;
    }
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Set canvas dimensions based on container size
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    
    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Extract prices for plotting
    const prices = priceHistory.map(data => data.price);
    
    // Find min and max for scaling
    const minPrice = Math.min(...prices) * 0.999;
    const maxPrice = Math.max(...prices) * 1.001;
    const priceRange = maxPrice - minPrice;
    
    // Draw background
    ctx.fillStyle = '#121826';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Draw grid
    ctx.lineWidth = 0.5;
    ctx.strokeStyle = '#2a3346';
    
    // Horizontal grid lines
    const gridLines = 5;
    for (let i = 0; i <= gridLines; i++) {
      const y = canvas.height - (i / gridLines) * canvas.height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
      
      // Price labels
      const gridPrice = minPrice + (i / gridLines) * priceRange;
      ctx.fillStyle = '#8a95aa';
      ctx.font = '10px sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(gridPrice.toFixed(2), 5, y - 5);
    }
    
    // Draw price line
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#2196f3';
    ctx.beginPath();
    
    const timeWindow = priceHistory.length;
    
    priceHistory.forEach((data, index) => {
      const x = (index / (timeWindow - 1)) * canvas.width;
      const y = canvas.height - ((data.price - minPrice) / priceRange) * canvas.height;
      
      if (index === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    
    ctx.stroke();
    
    // Add gradient fill
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, 'rgba(33, 150, 243, 0.3)');
    gradient.addColorStop(1, 'rgba(33, 150, 243, 0.05)');
    
    ctx.fillStyle = gradient;
    ctx.beginPath();
    
    // Start from bottom-left corner
    ctx.lineTo(0, canvas.height);
    
    // Redraw the price line
    priceHistory.forEach((data, index) => {
      const x = (index / (timeWindow - 1)) * canvas.width;
      const y = canvas.height - ((data.price - minPrice) / priceRange) * canvas.height;
      ctx.lineTo(x, y);
    });
    
    // Close the path to bottom-right corner
    ctx.lineTo(canvas.width, canvas.height);
    ctx.closePath();
    ctx.fill();
    
    // Draw chart title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${feedName} - Recent Price History`, canvas.width / 2, 20);
    
  }, [priceHistory, feedName]);
  
  return (
    <div className="price-chart">
      {priceHistory.length < 2 ? (
        <div className="loading-message">
          Collecting data points...
        </div>
      ) : null}
      <canvas ref={canvasRef}></canvas>
    </div>
  );
};

export default PriceChart;