import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Platform, Text, View } from 'react-native';
import { api } from './api';
import { colors, fonts, radius } from '../components/ui';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [trips, setTrips] = useState([]);
  const [tripId, setTripId] = useState(null);
  const [version, setVersion] = useState(0); // força recarregar as telas depois de uma ação
  const [toast, setToast] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;

  const showToast = useCallback(
    (msg) => {
      setToast(msg);
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(2200),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(() => setToast(null));
    },
    [opacity],
  );

  const loadMe = useCallback(async () => {
    const me = await api.me();
    setUser(me.user);
    setTrips(me.trips);
    setTripId((cur) => (cur && me.trips.some((t) => t.id === cur) ? cur : me.trips[0]?.id || null));
    return me;
  }, []);

  const value = useMemo(
    () => ({
      api,
      user,
      trips,
      tripId,
      setTripId,
      loadMe,
      version,
      refresh: () => setVersion((v) => v + 1),
      showToast,
      track: (name) => api.event?.(name, tripId),
      setScenario: async (s) => {
        api.setScenario?.(s);
        await loadMe();
        setVersion((v) => v + 1);
      },
    }),
    [user, trips, tripId, loadMe, version, showToast],
  );

  return (
    <Ctx.Provider value={value}>
      {children}
      {toast ? (
        <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 20, right: 20, bottom: Platform.OS === 'web' ? 110 : 120, opacity, alignItems: 'center' }}>
          <View style={{ backgroundColor: colors.ink, borderRadius: radius.pill, paddingHorizontal: 18, paddingVertical: 12 }}>
            <Text style={{ color: colors.white, fontFamily: fonts.bodySemi, fontSize: 14 }}>{toast}</Text>
          </View>
        </Animated.View>
      ) : null}
    </Ctx.Provider>
  );
}

/** Carrega dados e recarrega quando a viagem muda ou alguém chama refresh(). */
export function useLoad(fn, deps = []) {
  const { version } = useApp();
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const reload = useCallback(async () => {
    try {
      const data = await fn();
      setState({ data, loading: false, error: null });
    } catch (error) {
      setState({ data: null, loading: false, error });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  useEffect(() => {
    reload();
  }, [reload, version]);
  return { ...state, reload };
}
