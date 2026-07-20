import 'bootstrap/dist/js/bootstrap.bundle.min.js';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Provider } from 'react-redux';
import { QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { store } from './store/store';
import { queryClient } from './services/queryClient';
import { startErrorMonitoring } from './services/errorMonitoring';
import './index.css';

// Start client error monitoring early (no-op in dev / without a key).
startErrorMonitoring();

const container = document.getElementById('root');
if (!container)
    throw new Error('Root element #root not found.');
createRoot(container).render(<StrictMode>
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter basename="/emr">
          <App />
        </BrowserRouter>
      </QueryClientProvider>
    </Provider>
  </StrictMode>);
