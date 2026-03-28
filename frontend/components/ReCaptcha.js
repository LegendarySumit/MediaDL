"use client";

import { useEffect, useRef, useState } from 'react';

export default function ReCaptcha({ onVerify, siteKey }) {
  useEffect(() => {
    // Load reCAPTCHA script
    if (!siteKey) return;

    const script = document.createElement('script');
    script.src = `https://www.google.com/recaptcha/api.js?render=${siteKey}`;
    script.async = true;
    document.body.appendChild(script);

    return () => {
      // Cleanup
      const existingScript = document.querySelector(`script[src*="recaptcha"]`);
      if (existingScript) {
        document.body.removeChild(existingScript);
      }
    };
  }, [siteKey]);

  const executeRecaptcha = async (action = 'submit') => {
    if (!siteKey || !window.grecaptcha) {
      // If reCAPTCHA is not configured, return null (bypass)
      return null;
    }

    try {
      await window.grecaptcha.ready();
      const token = await window.grecaptcha.execute(siteKey, { action });
      if (onVerify) {
        onVerify(token);
      }
      return token;
    } catch (error) {
      console.error('reCAPTCHA error:', error);
      return null;
    }
  };

  return { executeRecaptcha };
}

// Hook for easy usage
export function useReCaptcha() {
  const recaptchaSiteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;

  const isTestRuntime = process.env.NODE_ENV === 'test' || process.env.NEXT_PUBLIC_PLAYWRIGHT_TEST === 'true';
  const initialProvider = isTestRuntime
    ? 'none'
    : (turnstileSiteKey ? 'turnstile' : (recaptchaSiteKey ? 'recaptcha' : 'none'));

  const [isReady, setIsReady] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState(null);
  const [provider, setProvider] = useState(() => initialProvider);
  const [lastErrorCode, setLastErrorCode] = useState(null);
  const turnstileWidgetIdRef = useRef(null);

  useEffect(() => {
    setProvider(initialProvider);
    setLastErrorCode(null);
    setIsReady(false);
    setTurnstileToken(null);
    turnstileWidgetIdRef.current = null;
  }, [initialProvider]);

  useEffect(() => {
    if (provider === 'none') {
      setIsReady(false);
      return;
    }

    if (provider === 'recaptcha') {
      const existingScript = document.querySelector('script[data-recaptcha="v3"]');
      if (!existingScript) {
        const script = document.createElement('script');
        script.src = `https://www.google.com/recaptcha/api.js?render=${recaptchaSiteKey}`;
        script.async = true;
        script.defer = true;
        script.dataset.recaptcha = 'v3';
        script.onload = () => setIsReady(true);
        script.onerror = () => setIsReady(false);
        document.body.appendChild(script);
        return;
      }

      if (window.grecaptcha) {
        setIsReady(true);
      }
      return;
    }

    const existingScript = document.querySelector('script[data-turnstile="v0"]');
    if (!existingScript) {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
      script.async = true;
      script.defer = true;
      script.dataset.turnstile = 'v0';
      script.onload = () => setIsReady(true);
      script.onerror = () => setIsReady(false);
      document.body.appendChild(script);
      return;
    }

    if (window.turnstile) {
      setIsReady(true);
    }
  }, [provider, recaptchaSiteKey]);

  const mountTurnstile = (containerId, onToken) => {
    if (provider !== 'turnstile' || !window.turnstile || !turnstileSiteKey) {
      return;
    }

    if (turnstileWidgetIdRef.current !== null) {
      return;
    }

    const widgetId = window.turnstile.render(`#${containerId}`, {
      sitekey: turnstileSiteKey,
      theme: 'auto',
      size: 'flexible',
      callback: (token) => {
        setLastErrorCode(null);
        setTurnstileToken(token);
        if (onToken) onToken(token);
      },
      'expired-callback': () => {
        setTurnstileToken(null);
        if (onToken) onToken(null);
      },
      'error-callback': (errorCode) => {
        const normalizedCode = String(errorCode || 'turnstile-widget-error');
        setLastErrorCode(normalizedCode);
        setTurnstileToken(null);
        if (onToken) onToken(null);

        // Fallback when Turnstile is misconfigured for this host (e.g. 600010)
        if (recaptchaSiteKey) {
          setProvider('recaptcha');
        } else {
          setProvider('none');
        }
      },
    });

    turnstileWidgetIdRef.current = widgetId;
  };

  const resetTurnstile = () => {
    if (provider !== 'turnstile' || !window.turnstile || turnstileWidgetIdRef.current === null) {
      setTurnstileToken(null);
      return;
    }
    window.turnstile.reset(turnstileWidgetIdRef.current);
    setTurnstileToken(null);
  };

  const executeRecaptcha = async (action = 'submit') => {
    if (provider === 'none') {
      // reCAPTCHA not configured, bypass
      return null;
    }

    if (provider === 'turnstile') {
      return turnstileToken;
    }

    if (!window.grecaptcha) {
      console.warn('reCAPTCHA not loaded yet');
      return null;
    }

    try {
      await window.grecaptcha.ready();
      const token = await window.grecaptcha.execute(recaptchaSiteKey, { action });
      setIsReady(true);
      return token;
    } catch (error) {
      console.error('reCAPTCHA error:', error);
      return null;
    }
  };

  return {
    executeRecaptcha,
    isEnabled: provider !== 'none',
    isReady,
    provider,
    lastErrorCode,
    mountTurnstile,
    resetTurnstile,
    turnstileToken,
  };
}
