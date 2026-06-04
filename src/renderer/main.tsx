import React from 'react';
import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import App from './App';
import i18n from '@/locales';
import { store } from '@/store';
import './index.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('Renderer root element #root is missing');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <Provider store={store}>
      <I18nextProvider i18n={i18n}>
        <App />
      </I18nextProvider>
    </Provider>
  </React.StrictMode>
);
