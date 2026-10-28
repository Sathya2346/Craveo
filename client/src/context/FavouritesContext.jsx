import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../lib/api.js';
import { useAuth } from './AuthContext.jsx';
import { useToast } from './ToastContext.jsx';

const FavouritesContext = createContext(null);

export const FavouritesProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [ids, setIds] = useState(new Set());
  const [foods, setFoods] = useState([]);
  const [loading, setLoading] = useState(false);
  const toast = useToast();

  const refresh = useCallback(async () => {
    if (!isAuthenticated) {
      setIds(new Set());
      setFoods([]);
      return;
    }
    setLoading(true);
    try {
      const [idsResponse, foodsResponse] = await Promise.all([
        api.get('/favourites/ids'),
        api.get('/favourites'),
      ]);
      setIds(new Set(idsResponse.data.data));
      setFoods(foodsResponse.data.data);
    } catch {
      // Silent: favourites are a nice-to-have, not a blocking feature.
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    refresh();
  }, [refresh, user?.id]);

  const toggle = useCallback(
    async (foodId) => {
      if (!isAuthenticated) {
        toast.info('Sign in to save your favourite dishes');
        return { ok: false, needsAuth: true };
      }
      const isSaved = ids.has(foodId);
      setIds((current) => {
        const next = new Set(current);
        if (isSaved) next.delete(foodId);
        else next.add(foodId);
        return next;
      });
      try {
        if (isSaved) await api.delete(`/favourites/${foodId}`);
        else await api.post('/favourites', { foodId });
        refresh();
        return { ok: true, isFavourite: !isSaved };
      } catch (error) {
        setIds((current) => {
          const next = new Set(current);
          if (isSaved) next.add(foodId);
          else next.delete(foodId);
          return next;
        });
        toast.error(error.response?.data?.error?.message || 'Could not update favourites');
        return { ok: false };
      }
    },
    [ids, isAuthenticated, refresh, toast],
  );

  const value = useMemo(
    () => ({ ids, foods, loading, toggle, refresh, isFavourite: (id) => ids.has(id) }),
    [ids, foods, loading, toggle, refresh],
  );

  return <FavouritesContext.Provider value={value}>{children}</FavouritesContext.Provider>;
};

export const useFavourites = () => {
  const context = useContext(FavouritesContext);
  if (!context) throw new Error('useFavourites must be used inside FavouritesProvider');
  return context;
};
