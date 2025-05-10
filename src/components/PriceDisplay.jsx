import React, { useState, useEffect, useRef } from 'react';
import './PriceDisplay.css';

const PriceDisplay = ({ priceData, feedName }) => {
  const [priceDirection, setPriceDirection] = useState(null);
  const previousPriceRef = useRef(null);
  const flashTimeoutRef = useRef(null);
  
  useEffect(() => {
    if (!priceData) return;
    
    // Determine price direction for visual indication
    if (previousPriceRef.current !== null) {
      if (priceData.price > previousPriceRef.current) {
        setPriceDirection('up');
      } else if (priceData.price < previousPriceRef.current) {
        setPriceDirection('down');
      }
    }
    
    // Store current price for next comparison
    previousPriceRef.current = priceData.price;
    
    // Reset the direction indicator after a short period
    if (flashTimeoutRef.current) {
      clearTimeout(flashTimeoutRef.current);
    }
    
    flashTimeoutRef.current = setTimeout(() => {
      setPriceDirection(null);
    }, 500);
    
    return () => {
      if (flashTimeoutRef.current) {
        clearTimeout(flashTimeoutRef.current);
      }
    };
  }, [priceData]);
  
  if (!priceData) {
    return (
      <div className="price-display loading">
        <div className="feed-name">{feedName}</div>
        <div className="price-value">Loading...</div>
      </div>
    );
  }
  
  // Format price with appropriate decimal places
  const formatPrice = (price) => {
    if (Math.abs(price) < 0.01) {
      return price.toFixed(6);
    } else if (Math.abs(price) < 1) {
      return price.toFixed(4);
    } else if (Math.abs(price) < 1000) {
      return price.toFixed(2);
    } else {
      return price.toLocaleString('en-US', { 
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      });
    }
  };
  
  const formattedPrice = formatPrice(priceData.price);
  const formattedConfidence = formatPrice(priceData.confidence);
  
  return (
    <div className={`price-display ${priceDirection}`}>
      <div className="feed-name">{feedName}</div>
      <div className="price-value">{formattedPrice}</div>
      <div className="price-details">
        <div className="confidence">
          <span className="label">Confidence:</span>
          <span className="value">±{formattedConfidence}</span>
        </div>
        <div className="timestamp">
          <span className="label">Last Update:</span>
          <span className="value">
            {new Date(priceData.timestamp).toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};

export default PriceDisplay;