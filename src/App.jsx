import React, { useState, useEffect, useRef, useCallback } from 'react';
import './App.css';
import PriceDisplay from './components/PriceDisplay';
import PriceChart from './components/PriceChart';
import WebSocketManager from './utils/WebSocketManager';
import PriceDataParser from './utils/PriceDataParser';

// Available price feeds from the README
const PRICE_FEEDS = [
  { name: 'SOL/USD', address: 'ENYwebBThHzmzwPLAQvCucUTsjyfBSZdD9ViXksS4jPu', category: 'Pyth Lazer' },
  { name: 'BTC/USD', address: '71wtTRDY8Gxgw56bXFt2oc6qeAbTxzStdNiC425Z51sr', category: 'Pyth Lazer' },
  { name: 'ETH/USD', address: '5vaYr1hpv8yrSpu8w3K95x22byYxUJCCNCSYJtqVWPvG', category: 'Pyth Lazer' },
  { name: 'USDC/USD', address: 'Ekug3x6hs37Mf4XKCDptvRVCSCjJCAD7LKmKQXBAa541', category: 'Pyth Lazer' },
  // Add the specific feed from your example
  { name: 'Custom Feed', address: '7AxV2515SwLFVxWSpCngQ3TNqY17JERwcCfULc464u7D', category: 'Custom' }
];

// Maximum number of price history points to keep
const MAX_HISTORY_POINTS = 100;

// Performance optimization: limit update rate to avoid rendering bottlenecks
const UPDATE_LIMIT_MS = 50; // 50ms = 20 updates per second max

function App() {
  const [selectedFeed, setSelectedFeed] = useState(PRICE_FEEDS[4]); // Default to the custom feed
  const [priceData, setPriceData] = useState(null);
  const [priceHistory, setPriceHistory] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [updateCount, setUpdateCount] = useState(0);
  const [updatesPerSecond, setUpdatesPerSecond] = useState(0);
  
  // Refs for WebSocket and performance management
  const wsManagerRef = useRef(null);
  const lastUpdateTimeRef = useRef(Date.now());
  const updateCounterRef = useRef(0);
  const fpsIntervalRef = useRef(null);
  const pendingUpdateRef = useRef(null);
  
  // Initialize WebSocket manager
  useEffect(() => {
    wsManagerRef.current = new WebSocketManager('wss://devnet.magicblock.app', {
      reconnectInterval: 2000,
      maxReconnectAttempts: 10
    });
    
    // Set up FPS counter interval
    fpsIntervalRef.current = setInterval(() => {
      setUpdatesPerSecond(updateCounterRef.current);
      updateCounterRef.current = 0;
    }, 1000);
    
    // Clean up on component unmount
    return () => {
      if (wsManagerRef.current) {
        wsManagerRef.current.disconnect();
      }
      
      if (fpsIntervalRef.current) {
        clearInterval(fpsIntervalRef.current);
      }
    };
  }, []);
  
  // Handle price update messages
  const handlePriceUpdate = useCallback((message) => {
    if (message.method === 'accountNotification') {
      const data = message.params.result.value.data;
      const parsedData = PriceDataParser.parseData(data);
      
      if (parsedData) {
        // Throttle updates for performance optimization
        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdateTimeRef.current;
        
        // Clear any pending updates
        if (pendingUpdateRef.current) {
          clearTimeout(pendingUpdateRef.current);
        }
        
        // If we're updating too frequently, schedule the update for later
        if (timeSinceLastUpdate < UPDATE_LIMIT_MS) {
          pendingUpdateRef.current = setTimeout(() => {
            updatePrice(parsedData);
          }, UPDATE_LIMIT_MS - timeSinceLastUpdate);
        } else {
          // Otherwise, update immediately
          updatePrice(parsedData);
        }
      }
    }
  }, []);
  
  // Update price state and metrics
  const updatePrice = useCallback((parsedData) => {
    setPriceData(parsedData);
    
    // Update price history (keeping limited data points)
    setPriceHistory(prevHistory => {
      const newHistory = [...prevHistory, parsedData];
      if (newHistory.length > MAX_HISTORY_POINTS) {
        return newHistory.slice(-MAX_HISTORY_POINTS);
      }
      return newHistory;
    });
    
    // Update metrics
    updateCounterRef.current += 1;
    setUpdateCount(prevCount => prevCount + 1);
    lastUpdateTimeRef.current = Date.now();
  }, []);
  
  // Handle feed selection and subscription
  useEffect(() => {
    if (!selectedFeed || !wsManagerRef.current) return;
    
    // Reset state for new feed
    setPriceHistory([]);
    setPriceData(null);
    setErrorMessage('');
    
    const connectAndSubscribe = async () => {
      try {
        // Connect to WebSocket server
        await wsManagerRef.current.connect();
        setIsConnected(true);
        
        // Unsubscribe from any previous feeds
        PRICE_FEEDS.forEach(feed => {
          if (feed.address !== selectedFeed.address) {
            wsManagerRef.current.unsubscribe(feed.address);
          }
        });
        
        // Subscribe to the selected feed
        await wsManagerRef.current.subscribe(selectedFeed.address);
        
        // Set up message handler
        const removeHandler = wsManagerRef.current.onMessage(handlePriceUpdate);
        
        return () => {
          removeHandler();
        };
      } catch (error) {
        console.error('Connection error:', error);
        setErrorMessage(`Connection error: ${error.message}`);
        setIsConnected(false);
      }
    };
    
    connectAndSubscribe();
    
    // Update connection status periodically
    const statusInterval = setInterval(() => {
      if (wsManagerRef.current) {
        setIsConnected(wsManagerRef.current.getStatus());
      }
    }, 1000);
    
    return () => {
      clearInterval(statusInterval);
    };
  }, [selectedFeed, handlePriceUpdate]);
  
  // Manual reconnect handler
  const handleReconnect = () => {
    if (wsManagerRef.current) {
      wsManagerRef.current.disconnect();
      
      // Short delay before reconnecting
      setTimeout(() => {
        wsManagerRef.current.connect().then(() => {
          setIsConnected(true);
          setErrorMessage('');
          
          // Re-subscribe to the current feed
          if (selectedFeed) {
            wsManagerRef.current.subscribe(selectedFeed.address);
          }
        }).catch(error => {
          setErrorMessage(`Reconnection failed: ${error.message}`);
        });
      }, 500);
    }
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Real-time Price Oracle</h1>
        <div className="connection-status">
          Status: <span className={isConnected ? 'connected' : 'disconnected'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </header>
      
      <main className="app-main">
        <div className="controls">
          <div className="feed-selector">
            <label htmlFor="feed-select">Select Price Feed:</label>
            <select 
              id="feed-select"
              value={selectedFeed.address}
              onChange={(e) => {
                const newFeed = PRICE_FEEDS.find(feed => feed.address === e.target.value);
                setSelectedFeed(newFeed);
              }}
            >
              {PRICE_FEEDS.map(feed => (
                <option key={feed.address} value={feed.address}>
                  {feed.name} ({feed.category})
                </option>
              ))}
            </select>
          </div>
          
          <button 
            className="reconnect-button"
            onClick={handleReconnect}
            disabled={isConnected}
          >
            Reconnect
          </button>
        </div>
        
        {errorMessage && (
          <div className="error-message">
            {errorMessage}
          </div>
        )}
        
        <div className="metrics">
          <div className="metric">
            <span className="metric-label">Updates:</span>
            <span className="metric-value">{updateCount}</span>
          </div>
          <div className="metric">
            <span className="metric-label">Updates/sec:</span>
            <span className="metric-value">{updatesPerSecond}</span>
          </div>
        </div>
        
        <div className="price-container">
          <PriceDisplay 
            priceData={priceData} 
            feedName={selectedFeed.name} 
          />
        </div>
        
        <div className="chart-container">
          <PriceChart 
            priceHistory={priceHistory} 
            feedName={selectedFeed.name} 
          />
        </div>
      </main>
      
      <footer className="app-footer">
        <p>Data provided by Solana Ephemeral Rollups Price Oracle</p>
      </footer>
    </div>
  );
}

export default App;