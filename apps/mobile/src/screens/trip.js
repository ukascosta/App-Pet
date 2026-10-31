/** Preparação (checklist), detalhe da tarefa, documentos e visualizador. */
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Badge, Button, Card, EmptyState, Header, Icon, Loading, ProgressRing, Screen, Section, T, Tip, colors, radius, space } from '../components/ui';
import { useApp, useLoad } from '../lib/state';
import { dayMonth, dueText, fileSize } from '../lib/format';

const PRIORITY = { alta: ['red', 'Prioridade alta'], media: ['purple', 'Média'], baixa: ['green', 'Baixa'] };

export function ChecklistScreen({ navigation }) {
  const { api, tripId, showToast } = useApp();
  const insets = useSafeAreaInsets();
  const res = useLoad(() => (tripId ? api.tasks(tripId) : null), [tripId]);
  const [local, setLocal] = useState({});
  if (!tripId) return <Screen header={<Header title="Preparação" />}><EmptyState icon="list-checks" title="Nada pra preparar ainda" text="As tarefas aparecem quando sua viagem estiver no app." /></Screen>;
  if (res.loading || !res.data) return <Loading />;
  const tasks = res.data.tasks.map((t) => (t.id in local ? { ...t, done: local[t.id] } : t));
  const done = tasks.filter((t) => t.done).length;
  const percent = tasks.length ? Math.round((done / tasks.length) * 100) : 100;
  const now = tasks.filter((t) => !t.done && (t.overdue || t.days_left === null || t.days_left <= 14));
  const later = tasks.filter((t) => !t.done && !now.includes(t));
  const finished = tasks.filter((t) => t.done);

  const toggle = async (t) => {
    const next = !t.done;
    setLocal((l) => ({ ...l, [t.id]: next }));
    await api.setTaskDone(tripId, t.id, next);
    if (next) showToast(done + 1 === tasks.length ? 'Tudo pronto! Agora é só curtir 🎉' : 'Mandou bem! ✅');
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 140 + insets.bottom }} showsVerticalScrollIndicator={false}>
      <LinearGradient colors={[colors.purple500, colors.purple700]} style={{ paddingTop: insets.top + 16, paddingHorizontal: space.xl, paddingBottom: 40, borderBottomLeftRadius: 32, borderBottomRightRadius: 32 }}>
        <T v="h1" color={colors.white}>
          Preparação
        </T>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 20 }}>
          <ProgressRing percent={percent} size={96} stroke={10} track="rgba(255,255,255,0.18)">
            <T v="h2" color={colors.white}>
              {percent}%
            </T>
          </ProgressRing>
          <View style={{ flex: 1 }}>
            <T v="h3" color={colors.white}>
              {percent === 100 ? 'Tudo prontinho! 🎉' : percent >= 60 ? 'Tá voando! ✈️' : 'Bora riscar essa lista?'}
            </T>
            <T v="small" color="rgba(255,255,255,0.85)" style={{ marginTop: 4 }}>
              {done} de {tasks.length} feitas. A Vagari ajusta os prazos conforme a data da viagem.
            </T>
          </View>
        </View>
      </LinearGradient>
      <View style={{ paddingHorizontal: space.xl }}>
        {now.length ? (
          <Section title="Pra agora">
            <TaskList tasks={now} onToggle={toggle} onOpen={(t) => navigation.navigate('Task', { task: t })} />
          </Section>
        ) : null}
        {later.length ? (
          <Section title="Mais pra frente">
            <TaskList tasks={later} onToggle={toggle} onOpen={(t) => navigation.navigate('Task', { task: t })} />
          </Section>
        ) : null}
        {finished.length ? (
          <Section title={`Feitas (${finished.length})`}>
            <TaskList tasks={finished} onToggle={toggle} onOpen={(t) => navigation.navigate('Task', { task: t })} />
          </Section>
        ) : null}
      </View>
    </ScrollView>
  );
}

function TaskList({ tasks, onToggle, onOpen }) {
  return (
    <Card padded={false}>
      {tasks.map((t, i) => (
        <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: space.lg, paddingVertical: 14, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
          <Pressable onPress={() => onToggle(t)} hitSlop={10} accessibilityRole="checkbox" accessibilityState={{ checked: t.done }} accessibilityLabel={t.title}>
            <View style={{ width: 28, height: 28, borderRadius: 10, borderWidth: 2, borderColor: t.done ? colors.success : colors.purple300, backgroundColor: t.done ? colors.success : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {t.done ? <Icon name="check" size={18} color={colors.white} weight="fill" /> : null}
            </View>
          </Pressable>
          <Pressable onPress={() => onOpen(t)} style={{ flex: 1 }}>
            <T v="bodyStrong" style={t.done && { textDecorationLine: 'line-through', color: colors.muted }}>
              {t.title}
            </T>
            <T v="smallStrong" color={t.done ? colors.success : t.overdue ? colors.danger : t.days_left === null ? colors.orange600 : colors.muted} style={{ marginTop: 2 }}>
              {dueText(t)}
            </T>
          </Pressable>
          <Pressable onPress={() => onOpen(t)} hitSlop={8}>
            <Icon name="caret-right" size={18} color={colors.muted} />
          </Pressable>
        </View>
      ))}
    </Card>
  );
}

export function TaskScreen({ navigation, route }) {
  const { api, tripId, showToast, refresh } = useApp();
  const [t, setT] = useState(route.params.task);
  const toggle = async () => {
    await api.setTaskDone(tripId, t.id, !t.done);
    setT({ ...t, done: !t.done });
    showToast(!t.done ? 'Mandou bem! ✅' : 'Voltou pra lista');
    refresh();
  };
  const [tone, label] = PRIORITY[t.priority] || PRIORITY.media;
  return (
    <Screen header={<Header title="Tarefa" onBack={() => navigation.goBack()} />}>
      <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
        <Badge label={label} tone={tone} />
        <Badge label={t.due_date ? `Até ${dayMonth(t.due_date)}` : 'Faz agora'} tone="orange" icon="clock" />
      </View>
      <T v="h1" style={{ marginTop: 14 }}>
        {t.title}
      </T>
      <T v="body" style={{ marginTop: 12, fontSize: 16, lineHeight: 24 }}>
        {t.description}
      </T>
      {t.official_url ? (
        <View style={{ marginTop: space.xl }}>
          <Tip icon="shield-check" title="Fonte oficial" tone="purple">
            Regra de documento e entrada muda. Confere sempre no site oficial antes de viajar.
          </Tip>
          <Button title="Abrir site oficial" variant="secondary" icon="arrow-square-out" url={t.official_url} style={{ marginTop: 12 }} />
        </View>
      ) : null}
      <View style={{ gap: 10, marginTop: space.xxl }}>
        <Button title={t.done ? 'Marcar como não feita' : 'Já fiz! ✅'} variant={t.done ? 'outline' : 'primary'} onPress={toggle} />
        <Button title="Tenho uma dúvida" variant="ghost" icon="chat-teardrop-dots" onPress={() => navigation.navigate('Help')} />
      </View>
    </Screen>
  );
}

const DOC_ICON = { bilhete: 'airplane-tilt', reserva: 'bed', voucher: 'receipt', ingresso: 'tag', seguro: 'first-aid-kit', orientacao: 'book-open', outro: 'files' };

export function DocsScreen({ navigation }) {
  const { api, tripId } = useApp();
  const insets = useSafeAreaInsets();
  const res = useLoad(() => (tripId ? api.documents(tripId) : null), [tripId]);
  if (!tripId) return <Screen header={<Header title="Documentos" />}><EmptyState icon="files" title="Nenhum documento" text="Vouchers, bilhetes e seguro aparecem aqui assim que a Vagari enviar." /></Screen>;
  if (res.loading || !res.data) return <Loading />;
  const groups = res.data.groups;
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingHorizontal: space.xl, paddingBottom: 140 + insets.bottom }} showsVerticalScrollIndicator={false}>
      <T v="h1">Documentos</T>
      <T v="small">Tudo que você vai precisar, num lugar só.</T>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 18 }}>
        <Card tone="purple" style={{ flex: 1 }}>
          <Icon name="files" size={28} color={colors.white} weight="duotone" />
          <T v="h2" color={colors.white} style={{ marginTop: 8 }}>
            {res.data.documents.length}
          </T>
          <T v="small" color="rgba(255,255,255,0.85)">
            documentos
          </T>
        </Card>
        <Card tone="orange" style={{ flex: 1 }}>
          <Icon name="download-simple" size={28} color={colors.orange600} weight="duotone" />
          <T v="h2" style={{ marginTop: 8 }}>
            Offline
          </T>
          <T v="small">abre mesmo sem internet</T>
        </Card>
      </View>
      {groups.length === 0 ? <EmptyState icon="files" title="Nenhum documento ainda" text="Assim que a Vagari enviar, eles aparecem aqui." /> : null}
      {groups.map((g) => (
        <Section key={g.category} title={g.label}>
          <Card padded={false}>
            {g.documents.map((d, i) => (
              <Pressable key={d.id} onPress={() => navigation.navigate('DocViewer', { doc: d })} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: space.lg, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }, pressed && { opacity: 0.7 }]}>
                <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: colors.purple50, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={DOC_ICON[d.category] || 'files'} size={24} color={colors.purple600} weight="duotone" />
                </View>
                <View style={{ flex: 1 }}>
                  <T v="bodyStrong" numberOfLines={2}>
                    {d.title}
                  </T>
                  <T v="small">
                    PDF · {fileSize(d.size_bytes)}
                    {d.version > 1 ? ' · atualizado' : ''}
                  </T>
                </View>
                {d.version > 1 ? <Badge label="Novo" tone="solidOrange" /> : <Icon name="caret-right" size={18} color={colors.muted} />}
              </Pressable>
            ))}
          </Card>
        </Section>
      ))}
      <View style={{ marginTop: space.xxl }}>
        <Tip icon="shield-check" title="Seus documentos estão seguros" tone="purple">
          Só você e quem viaja com você enxergam esses arquivos.
        </Tip>
      </View>
    </ScrollView>
  );
}

export function DocViewerScreen({ navigation, route }) {
  const { showToast } = useApp();
  const d = route.params.doc;
  return (
    <Screen bg={colors.surfaceAlt} header={<Header title={d.title} subtitle={`${d.category_label} · versão ${d.version}`} onBack={() => navigation.goBack()} />}>
      {/* Prévia do PDF (no app real, o arquivo abre aqui e fica salvo pra uso offline) */}
      <View style={{ backgroundColor: colors.surface, borderRadius: radius.md, padding: 24, marginTop: 8, minHeight: 440, gap: 14 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <T v="h3" color={colors.purple700}>
            {d.category_label}
          </T>
          <Icon name="file-pdf" size={28} color={colors.danger} weight="duotone" />
        </View>
        <View style={{ height: 1, backgroundColor: colors.line }} />
        <T v="title">{d.title}</T>
        {[0.9, 0.75, 0.82, 0.6, 0.88, 0.7].map((w, i) => (
          <View key={i} style={{ height: 10, width: `${w * 100}%`, borderRadius: 5, backgroundColor: colors.surfaceAlt }} />
        ))}
        <View style={{ height: 90, borderRadius: radius.sm, backgroundColor: colors.purple50, alignItems: 'center', justifyContent: 'center', marginTop: 8 }}>
          <Icon name="seal-check" size={36} color={colors.purple400} weight="duotone" />
        </View>
        {[0.8, 0.65, 0.9].map((w, i) => (
          <View key={`b${i}`} style={{ height: 10, width: `${w * 100}%`, borderRadius: 5, backgroundColor: colors.surfaceAlt }} />
        ))}
        <T v="small" center style={{ marginTop: 'auto' }}>
          Prévia ilustrativa — no app, o PDF real abre aqui.
        </T>
      </View>
      {d.notes ? (
        <View style={{ marginTop: space.lg }}>
          <Tip title="Recado da Vagari">{d.notes}</Tip>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: space.xl }}>
        <Button title="Salvar offline" icon="download-simple" variant="secondary" full={false} style={{ flex: 1 }} onPress={() => showToast('Salvo no celular ✅')} />
        <Button title="Compartilhar" icon="share-network" full={false} style={{ flex: 1 }} onPress={() => showToast('Na prévia o compartilhamento fica desligado')} />
      </View>
    </Screen>
  );
}
