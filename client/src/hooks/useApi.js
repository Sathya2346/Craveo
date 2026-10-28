import { useCallback, useEffect, useState } from 'react';
import api, { getApiError } from '../lib/api.js';

export const useApi = (url, { skip = false } = {}) => {
  const [data, setData] = useState(null);
  const [meta, setMeta] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(!skip);
  const [error, setError] = useState(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!url || skip) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError(null);

    api
      .get(url)
      .then((response) => {
        if (!active) return;
        setData(response.data.data);
        setMeta(response.data.meta ?? null);
        setSummary(response.data.summary ?? null);
      })
      .catch((failure) => {
        if (active) setError(getApiError(failure).message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [url, skip, version]);

  const reload = useCallback(() => setVersion((current) => current + 1), []);

  return { data, meta, summary, loading, error, reload, setData };
};

export default useApi;
