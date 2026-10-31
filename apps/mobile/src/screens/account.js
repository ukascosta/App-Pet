/** Perfil, preferências, notificações, privacidade (LGPD), ajuda/WhatsApp e troca de viagem. */
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, Chip, EmptyState, Header, Icon, Input, ListRow, Loading, Photo, Screen, Section, T, Tip, Toggle, colors, radius, space } from '../components/ui';
import { useApp, useLoad } from '../lib/state';
import { ago, firstName, range } from '../lib/format';
import { INTERESTS, SCENARIOS } from '../../../../shared/demo.js';
import { AVATARS } from '../../../../shared/brand.js';
import { DESTINATIONS } from '../../../../shared/library.js';

export function ProfileScreen({ navigation }) {
  const { api, user, trips, setScenario, loadMe } = useApp();
  const insets = useSafeAreaInsets();
  const [scenario, setSc] = useState(api.scenario?.());
  const [support24, setSupport24] = useState(false);
  const [picking, setPicking] = useState(false);
  const logout = async () => {
    await api.logout();
    navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
  };
  return (
    <Screen header={<Header title="Seu perfil" onBack={() => navigation.goBack()} />}>
      <View style={{ alignItems: 'center', marginTop: 8 }}>
        <Pressable onPress={() => setPicking(!picking)} accessibilityLabel="Trocar avatar" accessibilityRole="button">
          <Avatar id={user?.preferences?.avatar} seed={user?.email} size={96} />
          <View style={{ position: 'absolute', right: -2, bottom: -2, width: 32, height: 32, borderRadius: 16, backgroundColor: colors.orange500, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderColor: colors.bg }}>
            <Icon name="pencil-simple" size={16} color={colors.ink} weight="fill" />
          </View>
        </Pressable>
        <T v="h2" style={{ marginTop: 12 }}>
          {user?.name}
        </T>
        <T v="small">{user?.email}</T>
      </View>
      {picking ? (
        <Card style={{ marginTop: space.lg }}>
          <T v="bodyStrong">Escolhe a sua carinha</T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 }}>
            {AVATARS.map((a) => {
              const on = (user?.preferences?.avatar || '') === a.id;
              return (
                <Pressable
                  key={a.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={`Avatar ${a.id.replace('face-', '')}`}
                  onPress={async () => {
                    await api.updateMe({ preferences: { ...(user?.preferences || {}), avatar: a.id } });
                    await loadMe();
                    setPicking(false);
                  }}
                  style={{ padding: 3, borderRadius: 30, borderWidth: 2.5, borderColor: on ? colors.orange500 : 'transparent' }}
                >
                  <Avatar id={a.id} size={50} />
                </Pressable>
              );
            })}
          </View>
        </Card>
      ) : null}

      <Card padded={false} style={{ marginTop: space.xxl, paddingHorizontal: space.lg }}>
        <ListRow icon="suitcase-rolling" title="Minhas viagens" subtitle={`${trips.length} ${trips.length === 1 ? 'viagem' : 'viagens'}`} onPress={() => navigation.navigate('TripSwitcher')} />
        <ListRow icon="heart" title="Favoritos" onPress={() => navigation.navigate('Favorites')} />
        <ListRow icon="sliders-horizontal" title="Meus interesses" subtitle="Deixa as dicas mais a sua cara" onPress={() => navigation.navigate('Preferences')} />
        <ListRow icon="bell" title="Notificações" onPress={() => navigation.navigate('NotificationSettings')} last />
      </Card>
      <Card padded={false} style={{ marginTop: space.lg, paddingHorizontal: space.lg }}>
        <ListRow icon="chat-teardrop-dots" iconTone="green" title="Falar com a Vagari" onPress={() => navigation.navigate('Help')} />
        <ListRow icon="shield-check" title="Privacidade e seus dados" onPress={() => navigation.navigate('Privacy')} />
        <ListRow icon="sign-out" iconTone="red" title="Sair" onPress={logout} last right={null} />
      </Card>

      {api.mode === 'demo' ? (
        <Section title="Modo demonstração">
          <Card>
            <T v="small">Só na prévia: troca o momento da viagem pra ver como o app muda.</T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>
              {Object.entries(SCENARIOS).map(([k, s]) => (
                <Chip
                  key={k}
                  label={s.label}
                  active={scenario === k}
                  onPress={async () => {
                    setSc(k);
                    await setScenario(k);
                  }}
                />
              ))}
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
              <T v="bodyStrong">Atendimento 24h ligado no painel</T>
              <Toggle
                value={support24}
                onValueChange={(v) => {
                  setSupport24(v);
                  api.setSupport({ support_24h: v });
                  loadMe();
                }}
              />
            </View>
          </Card>
        </Section>
      ) : null}
      <T v="small" center style={{ marginTop: space.xxl, marginBottom: insets.bottom }}>
        Vagari · versão 0.1.0
      </T>
    </Screen>
  );
}

export function PreferencesScreen({ navigation }) {
  const { api, user, loadMe, showToast } = useApp();
  const [sel, setSel] = useState(user?.preferences?.interests || []);
  const [restrictions, setRestrictions] = useState(user?.preferences?.restrictions || '');
  const [group, setGroup] = useState(user?.preferences?.group || '');
  const save = async () => {
    await api.updateMe({ preferences: { interests: sel, restrictions, group } });
    await loadMe();
    showToast('Salvo! 💜');
    navigation.goBack();
  };
  return (
    <Screen header={<Header title="Meus interesses" onBack={() => navigation.goBack()} />}>
      <T v="body">Tudo opcional. Serve pra gente caprichar nas indicações.</T>
      <Section title="Do que você curte">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {INTERESTS.map((it) => (
            <Chip key={it.key} label={it.label} icon={it.icon} active={sel.includes(it.key)} onPress={() => setSel((s) => (s.includes(it.key) ? s.filter((x) => x !== it.key) : [...s, it.key]))} />
          ))}
        </View>
      </Section>
      <Section title="Alguma restrição?">
        <Input placeholder="Ex.: vegetariana, alergia a camarão, mobilidade reduzida" value={restrictions} onChangeText={setRestrictions} multiline />
      </Section>
      <Section title="Quem vai com você?">
        <Input placeholder="Ex.: casal, família com 2 crianças, amigos" value={group} onChangeText={setGroup} />
      </Section>
      <Button title="Salvar" onPress={save} style={{ marginTop: space.xxl }} />
    </Screen>
  );
}

export function NotificationSettingsScreen({ navigation }) {
  const { api } = useApp();
  const me = useLoad(() => api.me(), []);
  const [prefs, setPrefs] = useState(null);
  useEffect(() => {
    if (me.data) setPrefs(me.data.notification_prefs);
  }, [me.data]);
  if (!prefs) return <Loading />;
  const set = (k, v) => {
    const next = { ...prefs, [k]: v };
    setPrefs(next);
    api.updateMe({ notification_prefs: next });
  };
  return (
    <Screen header={<Header title="Notificações" onBack={() => navigation.goBack()} />}>
      <Card style={{ marginTop: 8 }}>
        {[
          ['email_updates', 'Novidades da viagem', 'Documento novo, mudança no roteiro e avisos'],
          ['email_reminders', 'Lembretes de tarefas', 'Um toque quando o prazo tiver chegando'],
        ].map(([k, title, sub], i) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
            <View style={{ flex: 1 }}>
              <T v="bodyStrong">{title}</T>
              <T v="small">{sub}</T>
            </View>
            <Toggle value={prefs[k]} onValueChange={(v) => set(k, v)} />
          </View>
        ))}
      </Card>
      <View style={{ marginTop: space.lg }}>
        <Tip icon="warning" title="Avisos importantes sempre chegam">
          Coisas como mudança de voo ou greve no aeroporto a gente manda de qualquer jeito, pra sua segurança.
        </Tip>
      </View>
    </Screen>
  );
}

export function PrivacyScreen({ navigation }) {
  const { api, showToast } = useApp();
  const ask = async (kind) => {
    const r = await api.privacyRequest(kind);
    showToast(r.message || 'Pedido enviado!');
  };
  return (
    <Screen header={<Header title="Privacidade e dados" onBack={() => navigation.goBack()} />}>
      <Tip icon="shield-check" title="A gente leva isso a sério" tone="purple">
        Pedimos só o mínimo: nome e contato. Nada de foto de passaporte ou cartão por aqui.
      </Tip>
      <Card padded={false} style={{ marginTop: space.lg, paddingHorizontal: space.lg }}>
        <ListRow icon="download-simple" title="Baixar meus dados" subtitle="Um arquivo com tudo que o app guarda sobre você" onPress={() => showToast('Na prévia o download fica desligado')} />
        <ListRow icon="pencil-simple" title="Corrigir meus dados" onPress={() => ask('correction')} />
        <ListRow icon="trash" iconTone="red" title="Pedir exclusão da conta" subtitle="A equipe confirma pelo seu e-mail" onPress={() => ask('deletion')} last />
      </Card>
    </Screen>
  );
}

export function HelpScreen({ navigation }) {
  const { api, tripId, track } = useApp();
  const res = useLoad(() => api.help(tripId), [tripId]);
  const h = res.data;
  const FAQ = [
    ['Meu voo mudou, e agora?', 'A gente acompanha e atualiza seu roteiro. Se precisar de ajuda na hora, chama no WhatsApp.'],
    ['Perdi um documento', 'Todos ficam na aba Docs e funcionam offline. Pode mostrar direto do celular.'],
    ['Quero incluir um passeio', 'Manda pra gente no WhatsApp que a Vagari cota e coloca no seu roteiro.'],
  ];
  return (
    <Screen header={<Header title="Ajuda" onBack={() => navigation.goBack()} />}>
      <View style={{ borderRadius: radius.xl, backgroundColor: colors.purple600, padding: space.xxl, marginTop: 8, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', right: -40, top: -40, width: 180, height: 180, borderRadius: 90, backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <Icon name="chat-teardrop-dots" size={44} color={colors.white} weight="duotone" accent={colors.orange500} />
        <T v="h2" color={colors.white} style={{ marginTop: 12 }}>
          Chama a gente!
        </T>
        <T v="body" color="rgba(255,255,255,0.88)" style={{ marginTop: 6 }}>
          Fala com uma pessoa de verdade do time Vagari. A mensagem já vai com os dados da sua viagem.
        </T>
        {h ? (
          <Badge label={h.support_hours_text} tone={h.support_24h ? 'solidOrange' : 'glass'} icon="clock" style={{ marginTop: 14 }} />
        ) : null}
        <View style={{ marginTop: 18 }}>
          {h?.whatsapp_url ? (
            <Button title="Abrir WhatsApp" variant="whatsapp" icon="chat-teardrop-dots" url={h.whatsapp_url} onPress={() => track('whatsapp_click')} />
          ) : (
            <T v="small" color={colors.white}>
              O WhatsApp da Vagari ainda não foi configurado.
            </T>
          )}
        </View>
      </View>
      <Section title="Dúvidas rápidas">
        <Card padded={false} style={{ paddingHorizontal: space.lg }}>
          {FAQ.map(([q, a], i) => (
            <View key={q} style={{ paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
              <T v="bodyStrong">{q}</T>
              <T v="small" style={{ marginTop: 4 }}>
                {a}
              </T>
            </View>
          ))}
        </Card>
      </Section>
    </Screen>
  );
}

const N_ICON = { document: ['files', 'purple'], task_reminder: ['list-checks', 'orange'], trip_update: ['map-trifold', 'purple'], announcement: ['megaphone', 'orange'] };

export function NotificationsScreen({ navigation }) {
  const { api, refresh } = useApp();
  const res = useLoad(() => api.notifications(), []);
  useEffect(() => {
    if (res.data?.unread) setTimeout(() => api.readNotifications().then(refresh), 1500);
  }, [res.data, api, refresh]);
  const items = res.data?.notifications || [];
  return (
    <Screen header={<Header title="Notificações" onBack={() => navigation.goBack()} />}>
      {res.loading ? <Loading /> : null}
      {!res.loading && !items.length ? <EmptyState icon="bell" title="Tudo em dia!" text="Quando a Vagari mandar novidade, ela aparece aqui." /> : null}
      <View style={{ gap: 10, marginTop: 8 }}>
        {items.map((n) => {
          const [icon, tone] = N_ICON[n.kind] || ['bell', 'purple'];
          return (
            <Card key={n.id} style={[{ flexDirection: 'row', gap: 12 }, !n.read_at && { borderWidth: 1.5, borderColor: colors.purple200 }]}>
              <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: tone === 'orange' ? colors.orange50 : colors.purple50, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name={icon} size={24} color={tone === 'orange' ? colors.orange600 : colors.purple600} weight="duotone" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="bodyStrong">{n.title}</T>
                {n.body ? <T v="small">{n.body}</T> : null}
                <T v="small" color={colors.muted} style={{ marginTop: 4 }}>
                  há {ago(n.created_at)}
                </T>
              </View>
              {!n.read_at ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: colors.orange500, marginTop: 6 }} /> : null}
            </Card>
          );
        })}
      </View>
    </Screen>
  );
}

export function TripSwitcherScreen({ navigation }) {
  const { trips, tripId, setTripId } = useApp();
  const insets = useSafeAreaInsets();
  return (
    <Pressable style={{ flex: 1, backgroundColor: colors.overlay, justifyContent: 'flex-end' }} onPress={() => navigation.goBack()}>
      <Pressable style={{ backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.xl, paddingBottom: insets.bottom + space.xl }} onPress={() => {}}>
        <View style={{ width: 44, height: 5, borderRadius: 3, backgroundColor: colors.lineStrong, alignSelf: 'center', marginBottom: 16 }} />
        <T v="h2">Suas viagens</T>
        <ScrollView style={{ maxHeight: 460, marginTop: 14 }}>
          <View style={{ gap: 12 }}>
            {trips.map((t) => {
              const d = DESTINATIONS.find((x) => x.id === (t.cover || t.destination_id));
              const on = t.id === tripId;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => {
                    setTripId(t.id);
                    navigation.goBack();
                  }}
                >
                  <Photo photo={d?.photo} art={d?.art} style={[{ height: 120, padding: 16, justifyContent: 'flex-end' }, on && { borderWidth: 3, borderColor: colors.orange500 }]} rounded={radius.lg} iconSize={90}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
                      <View>
                        <T v="h3" color={colors.white}>
                          {t.name}
                        </T>
                        <T v="small" color="rgba(255,255,255,0.85)">
                          {range(t.start_date, t.end_date)}
                        </T>
                      </View>
                      {on ? <Badge label="Aberta" tone="solidOrange" icon="check" /> : null}
                    </View>
                  </Photo>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </Pressable>
    </Pressable>
  );
}
