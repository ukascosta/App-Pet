/** Entrada no app: abertura, apresentação, login sem senha (Apple, Google ou código por e-mail) e convite. */
import React, { useEffect, useRef, useState } from 'react';
import { Animated, Dimensions, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Button, Chip, Icon, Input, Photo, T, colors, fonts, radius, space } from '../components/ui';
import { useApp } from '../lib/state';
import { firstName } from '../lib/format';
import { INTERESTS } from '../../../../shared/demo.js';
import { DESTINATIONS } from '../../../../shared/library.js';

/** Marca provisória em texto até chegar o SVG oficial. */
export function Logo({ size = 40, color = colors.white, dot = colors.orange500 }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end' }} accessibilityLabel="Vagari">
      <T style={{ fontFamily: fonts.display, fontSize: size, lineHeight: size * 1.05, color, letterSpacing: -size * 0.03 }}>vagari</T>
      <View style={{ width: size * 0.2, height: size * 0.2, borderRadius: size, backgroundColor: dot, marginLeft: 2, marginBottom: size * 0.16 }} />
    </View>
  );
}

export function SplashScreen({ navigation }) {
  const scale = useRef(new Animated.Value(0.85)).current;
  const fade = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 6 }),
      Animated.timing(fade, { toValue: 1, duration: 500, useNativeDriver: true }),
    ]).start();
    const t = setTimeout(() => navigation.replace('Onboarding'), 1700);
    return () => clearTimeout(t);
  }, [navigation, scale, fade]);
  return (
    <LinearGradient colors={[colors.purple500, colors.purple700]} style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View style={{ transform: [{ scale }], opacity: fade, alignItems: 'center' }}>
        <Logo size={56} />
        <T v="body" color="rgba(255,255,255,0.85)" style={{ marginTop: 10 }}>
          sua viagem, do seu jeito
        </T>
      </Animated.View>
    </LinearGradient>
  );
}

const SLIDES = [
  { dest: 'paris', title: 'Sua viagem inteira\nnum só lugar', text: 'Voos, hotéis, roteiro e vouchers organizadinhos. Chega de caçar PDF no e-mail.' },
  { dest: 'machu-picchu', title: 'A gente cuida\ndos detalhes', text: 'A Vagari atualiza tudo pra você. Mudou alguma coisa? Você fica sabendo na hora.' },
  { dest: 'santorini', title: 'Explora como\nquem é de lá', text: 'Dicas do time Vagari, lugares perto do hotel e uma lista pra chamar de sua.' },
];

export function OnboardingScreen({ navigation }) {
  const [i, setI] = useState(0);
  const insets = useSafeAreaInsets();
  const { width } = Dimensions.get('window');
  const s = SLIDES[i];
  const d = DESTINATIONS.find((x) => x.id === s.dest);
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Photo photo={d.photo} art={d.art} rounded={0} style={{ height: '62%', paddingTop: insets.top + 12, paddingHorizontal: space.xl }} iconSize={Math.min(width * 0.55, 220)}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Logo size={28} />
          <Pressable onPress={() => navigation.replace('Login')} hitSlop={10}>
            <T v="smallStrong" color={colors.white}>
              Pular
            </T>
          </Pressable>
        </View>
        <View style={{ flex: 1 }} />
        <T v="caption" color="rgba(255,255,255,0.85)" style={{ marginBottom: 24 }}>
          📍 {d.city || d.country}
        </T>
      </Photo>
      <View style={{ flex: 1, marginTop: -28, backgroundColor: colors.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: space.xxl, paddingBottom: insets.bottom + space.xl }}>
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 18 }}>
          {SLIDES.map((_, k) => (
            <View key={k} style={{ height: 6, width: k === i ? 26 : 6, borderRadius: 3, backgroundColor: k === i ? colors.orange500 : colors.purple200 }} />
          ))}
        </View>
        <T v="h1">{s.title}</T>
        <T v="body" style={{ marginTop: 10 }}>
          {s.text}
        </T>
        <View style={{ flex: 1 }} />
        <Button title={i < SLIDES.length - 1 ? 'Próximo' : 'Bora começar!'} iconRight="arrow-right" onPress={() => (i < SLIDES.length - 1 ? setI(i + 1) : navigation.replace('Login'))} />
      </View>
    </View>
  );
}

export function LoginScreen({ navigation }) {
  const { api, loadMe } = useApp();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(null);

  const social = async (provider) => {
    setLoading(provider);
    try {
      await api.socialLogin(provider);
      await loadMe();
      navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };
  const sendCode = async () => {
    setError(null);
    setLoading('email');
    try {
      await api.requestCode(email);
      navigation.navigate('Code', { email: email.trim().toLowerCase() });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1 }} keyboardShouldPersistTaps="handled">
        <LinearGradient colors={[colors.purple500, colors.purple700]} style={{ paddingTop: insets.top + 24, paddingHorizontal: space.xxl, paddingBottom: 56 }}>
          <Logo size={34} />
          <T v="h1" color={colors.white} style={{ marginTop: 28 }}>
            E aí, bora{'\n'}entrar? ✈️
          </T>
          <T v="body" color="rgba(255,255,255,0.85)" style={{ marginTop: 8 }}>
            Sem senha, sem cadastro gigante. Usa o mesmo e-mail que você passou pra Vagari.
          </T>
        </LinearGradient>
        <View style={{ flex: 1, marginTop: -28, backgroundColor: colors.bg, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: space.xxl, paddingBottom: insets.bottom + space.xl, gap: 12 }}>
          <Button title="Continuar com Apple" icon="apple" variant="dark" onPress={() => social('apple')} loading={loading === 'apple'} />
          <Button title="Continuar com Google" icon="google-logo" variant="outline" onPress={() => social('google')} loading={loading === 'google'} />
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 }}>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
            <T v="small">ou com seu e-mail</T>
            <View style={{ flex: 1, height: 1, backgroundColor: colors.line }} />
          </View>
          <Input
            icon="envelope"
            placeholder="seu@email.com"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            textContentType="emailAddress"
            onSubmitEditing={sendCode}
            returnKeyType="send"
          />
          {error ? (
            <T v="small" color={colors.danger}>
              {error}
            </T>
          ) : null}
          <Button title="Receber código" onPress={sendCode} disabled={!email.includes('@')} loading={loading === 'email'} />
          <View style={{ marginTop: 12, padding: 14, borderRadius: radius.md, backgroundColor: colors.purple50, flexDirection: 'row', gap: 10 }}>
            <Icon name="envelope" size={20} color={colors.purple600} weight="duotone" />
            <T v="small" color={colors.inkSoft} style={{ flex: 1 }}>
              Recebeu um convite da Vagari? É só tocar no link do e-mail que você entra direto, sem digitar nada.
            </T>
          </View>
          <Pressable onPress={() => navigation.navigate('Invite', { token: 'demo' })} style={{ alignSelf: 'center', padding: 8 }}>
            <T v="small" color={colors.purple600}>
              (prévia) Simular abertura do convite
            </T>
          </Pressable>
          <T v="small" center style={{ marginTop: 'auto', paddingTop: 12 }}>
            Ao entrar você concorda com os Termos de uso e a Política de privacidade da Vagari.
          </T>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function CodeScreen({ navigation, route }) {
  const { api, loadMe } = useApp();
  const insets = useSafeAreaInsets();
  const email = route.params?.email || '';
  const [code, setCode] = useState('');
  const [error, setError] = useState(null);
  const [wait, setWait] = useState(30);
  const ref = useRef(null);
  useEffect(() => {
    const t = setInterval(() => setWait((w) => (w > 0 ? w - 1 : 0)), 1000);
    return () => clearInterval(t);
  }, []);
  const submit = async (c) => {
    setError(null);
    try {
      await api.verifyCode(email, c);
      const me = await loadMe();
      navigation.reset({ index: 0, routes: [{ name: me.user.preferences?.interests?.length ? 'Main' : 'Interests' }] });
    } catch (e) {
      setError(e.message);
      setCode('');
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 12, paddingHorizontal: space.xxl }}>
      <Pressable onPress={() => navigation.goBack()} style={{ width: 44, height: 44, justifyContent: 'center' }} accessibilityLabel="Voltar">
        <Icon name="arrow-left" size={24} />
      </Pressable>
      <View style={{ width: 64, height: 64, borderRadius: 22, backgroundColor: colors.purple50, alignItems: 'center', justifyContent: 'center', marginTop: 12 }}>
        <Icon name="envelope" size={34} color={colors.purple600} weight="duotone" />
      </View>
      <T v="h1" style={{ marginTop: 20 }}>
        Confere seu e-mail 📬
      </T>
      <T v="body" style={{ marginTop: 8 }}>
        Mandamos um código de 6 números pra <T v="bodyStrong">{email}</T>
      </T>
      <Pressable onPress={() => ref.current?.focus()} style={{ flexDirection: 'row', gap: 8, marginTop: 28 }}>
        {Array.from({ length: 6 }).map((_, i) => {
          const ch = code[i];
          const active = i === code.length;
          return (
            <View key={i} style={{ flex: 1, height: 60, borderRadius: 16, borderWidth: 2, borderColor: active ? colors.purple600 : ch ? colors.purple200 : colors.line, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' }}>
              <T style={{ fontFamily: fonts.display, fontSize: 26, color: colors.ink }}>{ch || ''}</T>
            </View>
          );
        })}
      </Pressable>
      <TextInput
        ref={ref}
        value={code}
        autoFocus
        onChangeText={(v) => {
          const c = v.replace(/\D/g, '').slice(0, 6);
          setCode(c);
          if (c.length === 6) submit(c);
        }}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={6}
        style={{ position: 'absolute', opacity: 0, height: 1, width: 1 }}
        accessibilityLabel="Código de 6 números"
      />
      {error ? (
        <T v="small" color={colors.danger} style={{ marginTop: 12 }}>
          {error}
        </T>
      ) : null}
      <T v="small" style={{ marginTop: 18 }}>
        Na prévia, qualquer código de 6 números funciona.
      </T>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 28 }}>
        <Pressable onPress={() => wait === 0 && (api.requestCode(email), setWait(30))} disabled={wait > 0}>
          <T v="smallStrong" color={wait > 0 ? colors.muted : colors.purple600}>
            {wait > 0 ? `Reenviar em ${wait}s` : 'Reenviar código'}
          </T>
        </Pressable>
        <Pressable onPress={() => navigation.goBack()}>
          <T v="smallStrong" color={colors.purple600}>
            Trocar e-mail
          </T>
        </Pressable>
      </View>
    </View>
  );
}

/** Link do convite (vagari.com.br/convite/…) abre aqui: um toque e pronto. */
export function InviteScreen({ navigation, route }) {
  const { api, loadMe } = useApp();
  const insets = useSafeAreaInsets();
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.inviteInfo(route.params?.token).then(setInfo).catch((e) => setError(e.message));
  }, [api, route.params?.token]);
  const d = DESTINATIONS.find((x) => x.id === 'italia');
  const accept = async () => {
    try {
      await api.acceptInvite(route.params?.token);
      await loadMe();
      navigation.reset({ index: 0, routes: [{ name: 'Interests' }] });
    } catch (e) {
      setError(e.message);
    }
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <Photo photo={d.photo} art={d.art} rounded={0} style={{ flex: 1, paddingTop: insets.top + 16, paddingHorizontal: space.xxl, paddingBottom: 48, justifyContent: 'space-between' }} iconSize={240}>
        <Logo size={28} />
        <View>
          <T v="caption" color={colors.orange300}>
            Convite da Vagari
          </T>
          <T v="h1" color={colors.white} style={{ marginTop: 8, fontSize: 36, lineHeight: 40 }}>
            {info ? `E aí, ${info.traveler_first_name}! 👋` : 'Carregando…'}
          </T>
          <T v="body" color="rgba(255,255,255,0.9)" style={{ marginTop: 10 }}>
            {info ? `Tá tudo prontinho da sua viagem "${info.trip_name}". Bora dar uma olhada?` : ''}
          </T>
        </View>
      </Photo>
      <View style={{ padding: space.xxl, paddingBottom: insets.bottom + space.xl, gap: 10 }}>
        {error ? (
          <T v="small" color={colors.danger}>
            {error}
          </T>
        ) : null}
        <Button title="Ver minha viagem" iconRight="arrow-right" onPress={accept} disabled={!info} />
        <T v="small" center>
          Esse link é só seu e funciona uma vez. Depois é só entrar com seu e-mail.
        </T>
      </View>
    </View>
  );
}

/** Preferências opcionais (PRD §4.1) — dá pra pular. */
export function InterestsScreen({ navigation }) {
  const { api, user, loadMe } = useApp();
  const insets = useSafeAreaInsets();
  const [sel, setSel] = useState(user?.preferences?.interests || []);
  const toggle = (k) => setSel((s) => (s.includes(k) ? s.filter((x) => x !== k) : [...s, k]));
  const go = async (save) => {
    if (save) await api.updateMe({ preferences: { interests: sel } });
    await loadMe();
    navigation.reset({ index: 0, routes: [{ name: 'Main' }] });
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top + 20, paddingHorizontal: space.xxl, paddingBottom: insets.bottom + space.xl }}>
      <View style={{ flexDirection: 'row', justifyContent: 'flex-end' }}>
        <Pressable onPress={() => go(false)} hitSlop={10}>
          <T v="smallStrong" color={colors.purple600}>
            Pular
          </T>
        </Pressable>
      </View>
      <T v="h1" style={{ marginTop: 12 }}>
        {`Prazer, ${firstName(user?.name) || 'viajante'}!\nDo que você curte?`}
      </T>
      <T v="body" style={{ marginTop: 8 }}>
        Assim a gente capricha nas dicas do Explorar. Escolhe quantos quiser.
      </T>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 28 }}>
        {INTERESTS.map((it) => {
          const on = sel.includes(it.key);
          return (
            <Pressable
              key={it.key}
              onPress={() => toggle(it.key)}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: on }}
              style={{ width: '47%', padding: 16, borderRadius: radius.lg, borderWidth: 2, borderColor: on ? colors.purple600 : colors.line, backgroundColor: on ? colors.purple50 : colors.surface, gap: 10 }}
            >
              <Icon name={it.icon} size={30} color={on ? colors.purple600 : colors.inkSoft} weight="duotone" accent={colors.orange500} />
              <T v="bodyStrong">{it.label}</T>
            </Pressable>
          );
        })}
      </View>
      <View style={{ flex: 1 }} />
      <Button title={sel.length ? 'Fechou, bora!' : 'Continuar'} onPress={() => go(true)} />
    </View>
  );
}

export { Chip };
