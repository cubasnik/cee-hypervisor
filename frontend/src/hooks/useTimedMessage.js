import { useCallback, useEffect, useRef, useState } from 'react';

export const useTimedMessage = (defaultDuration = 2000) => {
  const [message, setMessage] = useState('');
  const timeoutRef = useRef(null);

  const clearMessage = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setMessage('');
  }, []);

  const showMessage = useCallback((nextMessage, duration = defaultDuration) => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setMessage(nextMessage);

    if (duration > 0) {
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
        setMessage('');
      }, duration);
    }
  }, [defaultDuration]);

  useEffect(() => clearMessage, [clearMessage]);

  return {
    message,
    showMessage,
    clearMessage,
  };
};

export default useTimedMessage;