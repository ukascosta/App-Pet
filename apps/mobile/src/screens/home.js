/** Início: capa grande da viagem, contagem regressiva, progresso, voo, hotel, próximos rolês e avisos. */
import React from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Badge, Button, Card, EmptyState, Icon, IconButton, Loading, Photo, ProgressRing, Section, T, Tip, colors, radius, space } from '../components/ui';
import { useApp, useLoad } from '../lib/state';
import { dayMonth, dueText, firstName, range, time, weekdayShort } from '../lib/format';
import { DESTINATIONS } from '../../../../shared/library.js';

const destOf = (id) => DESTINATIONS.find((d) => d.id === id);

export function HomeScreen({ navigation }) {
  const { api, tripId, user, trips } = useApp();
  const insets = useSafeAreaInsets();
  const home = useLoad(() => (tripId ? api.home(tripId) : null), [tripId]);
  const notes = useLoad(() => api.notifications(), []);
  const guide = useLoad(() => (tripId ? api.guide(tripId, {}) : null), [tripId]);
  const inspo = useLoad(() => api.inspiration(), []);

  if (!tripId) return <NoTrip navigation={navigation} insets={insets} inspiration={inspo.data?.destinations} user={user} unread={notes.data?.unread} />;
  if (home.loading || !home.data) return <Loading />;
  const h = home.data;
  const d = destOf(h.trip.cover || h.trip.destination?.id);
  const during = h.countdown.phase === 'during';

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingBottom: 140 + insets.bottom }} showsVerticalScrollIndicator={false}>
      {/* Capa */}
      <Photo photo={d?.photo} art={d?.art} rounded={0} style={{ paddingTop: insets.top + 10, paddingHorizontal: space.xl, paddingBottom: 56, minHeight: 440 }} iconSize={230}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <Pressable onPress={() => navigation.navigate('Profile')} accessibilityLabel="Seu perfil">
            <Avatar id={user?.preferences?.avatar} seed={user?.email} size={46} ring="rgba(255,255,255,0.85)" />
          </Pressable>
          <Pressable onPress={() => trips.length > 1 && navigation.navigate('TripSwitcher')} style={{ flex: 1 }}>
            <T v="small" color="rgba(255,255,255,0.85)">
              Oi, {firstName(user?.name)}!
            </T>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <T v="title" color={colors.white} numberOfLines={1}>
                {trips.length > 1 ? 'Trocar viagem' : 'Sua viagem'}
              </T>
              {trips.length > 1 ? <Icon name="caret-down" size={16} color={colors.white} /> : null}
            </View>
          </Pressable>
          <IconButton icon="bell" bg="rgba(255,255,255,0.2)" color={colors.white} onPress={() => navigation.navigate('Notifications')} badge={notes.data?.unread || null} accessibilityLabel="Notificações" />
        </View>
        <View style={{ flex: 1, minHeight: 120 }} />
        <Badge label={during ? `Dia ${h.countdown.day_number} de ${h.countdown.total_days}` : h.countdown.days_to_start === 0 ? 'É hoje!' : `Faltam ${h.countdown.days_to_start} dias`} tone="solidOrange" icon={during ? 'sun' : 'clock'} />
        <T v="big" color={colors.white} style={{ marginTop: 12 }}>
          {h.trip.name}
        </T>
        <T v="bodyStrong" color="rgba(255,255,255,0.92)" style={{ marginTop: 6 }}>
          {h.cities?.length ? h.cities.join(' · ') : h.trip.destination?.name} • {range(h.trip.start_date, h.trip.end_date)}
        </T>
      </Photo>

      <View style={{ paddingHorizontal: space.xl, marginTop: -32 }}>
        {/* Preparação */}
        <Card onPress={() => navigation.navigate('Main', { screen: 'Checklist' })} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
          <ProgressRing percent={h.progress.percent} size={68}>
            <T v="smallStrong">{h.progress.percent}%</T>
          </ProgressRing>
          <View style={{ flex: 1 }}>
            <T v="caption">Preparação</T>
            <T v="title" style={{ marginTop: 2 }}>
              {h.progress.done === h.progress.total ? 'Tudo pronto! 🎉' : h.progress.percent >= 50 ? 'Tá quase lá!' : 'Bora se preparar?'}
            </T>
            {h.next_task ? (
              <T v="small" numberOfLines={1} style={{ marginTop: 2 }}>
                Próxima: {h.next_task.title} · <T v="smallStrong" color={h.next_task.overdue ? colors.danger : colors.orange600}>{dueText(h.next_task)}</T>
              </T>
            ) : null}
          </View>
          <Icon name="caret-right" size={18} color={colors.muted} />
        </Card>

        {/* Avisos da Vagari */}
        {h.announcements?.map((a) => (
          <View key={a.id} style={{ marginTop: 14, padding: space.lg, borderRadius: radius.lg, backgroundColor: a.essential ? colors.dangerBg : colors.purple600, flexDirection: 'row', gap: 12 }}>
            <Icon name="megaphone" size={26} color={a.essential ? colors.danger : colors.white} weight="duotone" accent={colors.orange500} />
            <View style={{ flex: 1 }}>
              <T v="title" color={a.essential ? colors.ink : colors.white}>
                {a.title}
              </T>
              <T v="small" color={a.essential ? colors.inkSoft : 'rgba(255,255,255,0.85)'} style={{ marginTop: 2 }}>
                {a.body}
              </T>
            </View>
          </View>
        ))}

        {/* Voo */}
        {h.next_flight ? (
          <Section title={during ? 'Voo de volta' : 'Próximo voo'}>
            <FlightCard f={h.next_flight} onPress={() => navigation.navigate('Flight', { flight: h.next_flight })} />
          </Section>
        ) : null}

        {/* Hospedagem */}
        {h.accommodation ? (
          <Section title={during ? 'Onde você tá' : 'Sua hospedagem'}>
            <Card onPress={() => navigation.navigate('Stay', { stay: h.accommodation })} style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
              <View style={{ width: 56, height: 56, borderRadius: 18, backgroundColor: colors.purple50, alignItems: 'center', justifyContent: 'center' }}>
                <Icon name="bed" size={30} color={colors.purple600} weight="duotone" />
              </View>
              <View style={{ flex: 1 }}>
                <T v="title">{h.accommodation.name}</T>
                <T v="small">
                  Check-in {weekdayShort(h.accommodation.checkin_at)}, {dayMonth(h.accommodation.checkin_at)} · {time(h.accommodation.checkin_at)}
                </T>
              </View>
              <Icon name="caret-right" size={18} color={colors.muted} />
            </Card>
          </Section>
        ) : null}

        {/* Próximos rolês */}
        {h.upcoming?.length ? (
          <Section title="Próximos rolês" action="Ver roteiro" onAction={() => navigation.navigate('Main', { screen: 'Roteiro' })}>
            <Card padded={false}>
              {h.upcoming.map((it, i) => (
                <Pressable key={it.id} onPress={() => navigation.navigate('Activity', { item: it })} style={{ flexDirection: 'row', gap: 14, padding: space.lg, borderTopWidth: i ? 1 : 0, borderTopColor: colors.line }}>
                  <View style={{ alignItems: 'center', width: 44 }}>
                    <T v="caption" color={colors.purple600}>
                      {weekdayShort(it.date)}
                    </T>
                    <T v="h3">{dayMonth(it.date).split(' ')[0]}</T>
                  </View>
                  <View style={{ flex: 1 }}>
                    <T v="bodyStrong" numberOfLines={1}>
                      {it.title}
                    </T>
                    <T v="small">
                      {it.start_time ? `${it.start_time} · ` : ''}
                      {it.category_label}
                    </T>
                  </View>
                </Pressable>
              ))}
            </Card>
          </Section>
        ) : null}

        {/* Explorar */}
        {guide.data?.places?.length ? (
          <Section title="Explora o destino" action="Ver tudo" onAction={() => navigation.navigate('Main', { screen: 'Explorar' })}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl }} contentContainerStyle={{ paddingHorizontal: space.xl, gap: 12 }}>
              {guide.data.places.slice(0, 6).map((p) => (
                <PlaceTile key={p.id} p={p} onPress={() => navigation.navigate('Place', { id: p.id })} />
              ))}
            </ScrollView>
          </Section>
        ) : null}

        {h.trip.general_notes ? (
          <View style={{ marginTop: space.xxl }}>
            <Tip title="Fica a dica">{h.trip.general_notes}</Tip>
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

export function FlightCard({ f, onPress }) {
  return (
    <Card onPress={onPress} style={{ padding: 0, overflow: 'hidden' }} padded={false}>
      <View style={{ padding: space.lg, backgroundColor: colors.purple600 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <T v="smallStrong" color="rgba(255,255,255,0.85)">
            {f.airline} · {f.flight_number}
          </T>
          <T v="smallStrong" color={colors.orange300}>
            {weekdayShort(f.departure_at)}, {dayMonth(f.departure_at)}
          </T>
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 14 }}>
          <View>
            <T v="big" color={colors.white} style={{ fontSize: 36 }}>
              {f.departure_airport}
            </T>
            <T v="small" color="rgba(255,255,255,0.8)">
              {f.departure_city || ''} {time(f.departure_at)}
            </T>
          </View>
          <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', width: '100%' }}>
              <View style={{ flex: 1, height: 1.5, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }} />
              <Icon name="airplane-tilt" size={24} color={colors.orange500} weight="fill" style={{ marginHorizontal: 6 }} />
              <View style={{ flex: 1, height: 1.5, borderStyle: 'dashed', borderWidth: 1, borderColor: 'rgba(255,255,255,0.5)' }} />
            </View>
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <T v="big" color={colors.white} style={{ fontSize: 36 }}>
              {f.arrival_airport}
            </T>
            <T v="small" color="rgba(255,255,255,0.8)">
              {f.arrival_city || ''} {time(f.arrival_at)}
            </T>
          </View>
        </View>
      </View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: space.lg }}>
        <View>
          <T v="caption">Localizador</T>
          <T v="title">{f.booking_reference || '—'}</T>
        </View>
        <Badge label="Ver detalhes" tone="purple" />
      </View>
    </Card>
  );
}

export function PlaceTile({ p, onPress, width = 200 }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width }, pressed && { opacity: 0.9 }]}>
      <Photo photo={p.photo} art={p.art} style={{ height: 230, padding: 12, justifyContent: 'space-between' }} rounded={radius.lg} iconSize={110}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          {p.highlight ? <Badge label="Indicação Vagari" tone="solidOrange" icon="seal-check" /> : <View />}
          {p.is_favorite ? <Icon name="heart" size={22} color={colors.white} weight="fill" /> : null}
        </View>
        <View>
          <T v="title" color={colors.white} numberOfLines={2}>
            {p.name}
          </T>
          <T v="small" color="rgba(255,255,255,0.85)">
            {p.category_label}
            {p.distance_km ? ` · ${String(p.distance_km).replace('.', ',')} km` : ''}
          </T>
        </View>
      </Photo>
    </Pressable>
  );
}

function NoTrip({ navigation, insets, inspiration, user, unread }) {
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: 140, paddingHorizontal: space.xl }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <T v="h2">Oi, {firstName(user?.name)}! 👋</T>
        <IconButton icon="user-circle" onPress={() => navigation.navigate('Profile')} accessibilityLabel="Perfil" />
      </View>
      <Card style={{ marginTop: 20 }}>
        <EmptyState icon="suitcase-rolling" title="Nenhuma viagem por aqui ainda" text="Assim que a Vagari fechar sua viagem, ela aparece aqui sozinha. Enquanto isso, que tal sonhar um pouquinho?" />
      </Card>
      <Section title="Inspire-se">
        <View style={{ gap: 12 }}>
          {(inspiration || []).slice(0, 6).map((d) => (
            <Pressable key={d.id} onPress={() => navigation.navigate('Destination', { id: d.id })}>
              <Photo photo={d.photo} art={d.art} style={{ height: 160, padding: 16, justifyContent: 'flex-end' }} rounded={radius.lg} iconSize={110}>
                <T v="h3" color={colors.white}>
                  {d.name}
                </T>
                <T v="small" color="rgba(255,255,255,0.85)">
                  {d.tagline}
                </T>
              </Photo>
            </Pressable>
          ))}
        </View>
      </Section>
      {unread ? null : null}
    </ScrollView>
  );
}

export { Button };
