/** Roteiro por dia + detalhes de voo, hospedagem e atividade (com "abrir no mapa"). */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, EmptyState, Header, Icon, Loading, Photo, Screen, T, Tip, colors, radius, space } from '../components/ui';
import { useApp, useLoad } from '../lib/state';
import { dayMonth, longDate, time, weekdayShort } from '../lib/format';
import { DESTINATIONS, PLACES } from '../../../../shared/library.js';

const TYPE = {
  flight: { icon: 'airplane-tilt', color: colors.purple600, bg: colors.purple50, label: 'Voo' },
  checkin: { icon: 'bed', color: colors.success, bg: colors.successBg, label: 'Check-in' },
  checkout: { icon: 'suitcase-rolling', color: colors.warning, bg: colors.warningBg, label: 'Check-out' },
  activity: { icon: 'map-pin-simple', color: colors.orange600, bg: colors.orange50, label: '' },
};
const CAT_ICON = { transfer: 'car', passeio: 'footprints', experiencia: 'confetti', restaurante: 'fork-knife', ingresso: 'receipt', transporte: 'bus', livre: 'sun', outro: 'map-pin-simple' };
const BOOKING_TONE = { confirmado: 'green', pendente: 'yellow', cancelado: 'red', nao_necessario: 'purple' };

export function ItineraryScreen({ navigation }) {
  const { api, tripId } = useApp();
  const insets = useSafeAreaInsets();
  const it = useLoad(() => (tripId ? api.itinerary(tripId) : null), [tripId]);
  const [sel, setSel] = useState(null);
  const strip = useRef(null);
  const days = it.data?.days || [];
  useEffect(() => {
    if (!days.length) return;
    setSel((s) => s ?? Math.max(days.findIndex((d) => d.is_today), 0));
  }, [days]);
  if (!tripId) return <Screen header={<Header title="Roteiro" />}><EmptyState icon="map-trifold" title="Sem roteiro ainda" text="Quando sua viagem estiver no app, o roteiro dia a dia aparece aqui." /></Screen>;
  if (it.loading) return <Loading />;
  const day = days[sel ?? 0];

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <View style={{ paddingTop: insets.top + 12, backgroundColor: colors.bg }}>
        <View style={{ paddingHorizontal: space.xl, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <View>
            <T v="h1">Roteiro</T>
            <T v="small">
              {days.length} dias · horários no fuso local de cada cidade
            </T>
          </View>
        </View>
        <ScrollView ref={strip} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.xl, paddingVertical: 16, gap: 10 }}>
          {days.map((d, i) => {
            const on = i === sel;
            return (
              <Pressable key={d.date} onPress={() => setSel(i)} accessibilityRole="tab" accessibilityState={{ selected: on }} style={{ width: 66, paddingVertical: 12, borderRadius: 20, alignItems: 'center', backgroundColor: on ? colors.purple600 : colors.surface, borderWidth: 1, borderColor: on ? colors.purple600 : colors.line }}>
                <T v="caption" color={on ? colors.orange300 : colors.muted}>
                  Dia {d.day_number}
                </T>
                <T v="h2" color={on ? colors.white : colors.ink} style={{ marginTop: 2 }}>
                  {dayMonth(d.date).split(' ')[0]}
                </T>
                <T v="small" color={on ? 'rgba(255,255,255,0.8)' : colors.muted}>
                  {weekdayShort(d.date)}
                </T>
                {d.is_today ? <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.orange500, marginTop: 4 }} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      <ScrollView contentContainerStyle={{ paddingHorizontal: space.xl, paddingBottom: 140 + insets.bottom }} showsVerticalScrollIndicator={false}>
        {day ? (
          <>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <T v="h3">
                {longDate(day.date).replace(/^./, (c) => c.toUpperCase())}
              </T>
              {day.city ? <Badge label={day.city} tone="orange" icon="map-pin-simple" /> : null}
            </View>
            {day.items.length === 0 ? (
              <Card>
                <EmptyState icon="sun" title="Dia livre! ☀️" text="Nada marcado. Que tal dar uma olhada no Explorar?" action="Explorar" onAction={() => navigation.navigate('Main', { screen: 'Explorar' })} />
              </Card>
            ) : (
              day.items.map((item, i) => <TimelineItem key={`${item.type}-${item.id}`} item={item} last={i === day.items.length - 1} navigation={navigation} />)
            )}
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function TimelineItem({ item, last, navigation }) {
  const t = TYPE[item.type];
  const icon = item.type === 'activity' ? CAT_ICON[item.category] || t.icon : t.icon;
  const open = () => {
    if (item.type === 'flight') navigation.navigate('Flight', { flight: item });
    else if (item.type === 'activity') navigation.navigate('Activity', { item });
    else navigation.navigate('Stay', { stay: item });
  };
  return (
    <View style={{ flexDirection: 'row', gap: 12 }}>
      <View style={{ width: 52, alignItems: 'center' }}>
        <T v="smallStrong" color={colors.ink}>
          {item.time || '—'}
        </T>
        <View style={{ width: 2, flex: 1, backgroundColor: last ? 'transparent' : colors.purple100, marginTop: 6 }} />
      </View>
      <Pressable onPress={open} style={({ pressed }) => [{ flex: 1, marginBottom: 14 }, pressed && { opacity: 0.9 }]}>
        <Card style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: t.bg, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={icon} size={24} color={t.color} weight="duotone" accent={colors.orange500} />
          </View>
          <View style={{ flex: 1 }}>
            <T v="caption" color={t.color}>
              {t.label || item.category_label}
            </T>
            <T v="title" style={{ marginTop: 2 }}>
              {item.title}
            </T>
            {item.subtitle ? <T v="small">{item.subtitle}</T> : null}
            {item.type === 'activity' && item.end_time ? <T v="small">até {item.end_time}</T> : null}
            {item.booking_status_label ? <Badge label={item.booking_status_label} tone={BOOKING_TONE[item.booking_status]} style={{ marginTop: 8 }} /> : null}
          </View>
        </Card>
      </Pressable>
    </View>
  );
}

function InfoRow({ icon, label, value, last }) {
  if (!value) return null;
  return (
    <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : 1, borderBottomColor: colors.line }}>
      <Icon name={icon} size={22} color={colors.purple600} weight="duotone" />
      <View style={{ flex: 1 }}>
        <T v="caption">{label}</T>
        <T v="bodyStrong" style={{ marginTop: 2 }} selectable>
          {value}
        </T>
      </View>
    </View>
  );
}

export function FlightScreen({ navigation, route }) {
  const f = route.params.flight;
  const insets = useSafeAreaInsets();
  return (
    <Screen header={<Header title="Seu voo" onBack={() => navigation.goBack()} />}>
      {/* Cartão de embarque */}
      <View style={{ borderRadius: radius.xl, overflow: 'hidden', marginTop: 8 }}>
        <View style={{ backgroundColor: colors.purple600, padding: space.xxl }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            <T v="bodyStrong" color={colors.white}>
              {f.airline}
            </T>
            <Badge label={f.flight_number} tone="solidOrange" />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }}>
            <View>
              <T v="big" color={colors.white}>
                {f.departure_airport}
              </T>
              <T v="small" color="rgba(255,255,255,0.8)">
                {f.departure_city}
              </T>
            </View>
            <Icon name="airplane-tilt" size={36} color={colors.orange500} weight="fill" />
            <View style={{ alignItems: 'flex-end' }}>
              <T v="big" color={colors.white}>
                {f.arrival_airport}
              </T>
              <T v="small" color="rgba(255,255,255,0.8)">
                {f.arrival_city}
              </T>
            </View>
          </View>
        </View>
        <View style={{ backgroundColor: colors.surface, padding: space.xxl, flexDirection: 'row', flexWrap: 'wrap', rowGap: 18 }}>
          {[
            ['Partida', `${dayMonth(f.departure_at)} · ${time(f.departure_at)}`],
            ['Chegada', `${dayMonth(f.arrival_at)} · ${time(f.arrival_at)}`],
            ['Localizador', f.booking_reference || '—'],
            ['Trecho', `${f.segment_order}`],
          ].map(([k, v]) => (
            <View key={k} style={{ width: '50%' }}>
              <T v="caption">{k}</T>
              <T v="h3" style={{ marginTop: 2 }} selectable>
                {v}
              </T>
            </View>
          ))}
        </View>
      </View>
      <T v="small" style={{ marginTop: 10 }}>
        Horários na hora local de cada aeroporto.
      </T>
      {f.notes ? (
        <View style={{ marginTop: space.xl }}>
          <Tip icon="suitcase-rolling" title="Bagagem e assentos" tone="purple">
            {f.notes}
          </Tip>
        </View>
      ) : null}
      <View style={{ marginTop: space.xl }}>
        <Tip title="Check-in online">O check-in geralmente abre 24h antes do voo no site ou app da companhia. Chega no aeroporto com folga, beleza?</Tip>
      </View>
      <View style={{ height: insets.bottom }} />
    </Screen>
  );
}

export function StayScreen({ navigation, route }) {
  const s = route.params.stay;
  const d = DESTINATIONS.find((x) => x.id === s.city_id) || DESTINATIONS.find((x) => x.city === s.city);
  return (
    <Screen padded={false} header={<Header transparent onBack={() => navigation.goBack()} />}>
      <Photo photo={d?.photo || `dest:${d?.id}`} art={d?.art} rounded={0} style={{ height: 300, justifyContent: 'flex-end', padding: space.xl }} iconSize={180}>
        <Badge label={d ? d.city : 'Hospedagem'} tone="white" icon="map-pin-simple" />
        <T v="h1" color={colors.white} style={{ marginTop: 10 }}>
          {s.title || s.name}
        </T>
      </Photo>
      <View style={{ padding: space.xl }}>
        <Card>
          {s.checkin_at ? <InfoRow icon="calendar-check" label="Check-in" value={`${longDate(s.checkin_at)} · ${time(s.checkin_at)}`} /> : null}
          {s.checkout_at ? <InfoRow icon="calendar" label="Check-out" value={`${longDate(s.checkout_at)} · ${time(s.checkout_at)}`} /> : null}
          <InfoRow icon="receipt" label="Código de confirmação" value={s.confirmation_code} />
          <InfoRow icon="map-pin-line" label="Endereço" value={s.address} last />
        </Card>
        {s.notes ? (
          <View style={{ marginTop: space.lg }}>
            <Tip title="Bom saber">{s.notes}</Tip>
          </View>
        ) : null}
        <View style={{ gap: 10, marginTop: space.xl }}>
          <Button title="Abrir no mapa" icon="map-trifold" url={s.maps_url} />
          <Button title="Ver voucher" icon="files" variant="secondary" onPress={() => navigation.navigate('Main', { screen: 'Docs' })} />
        </View>
      </View>
    </Screen>
  );
}

export function ActivityScreen({ navigation, route }) {
  const it = route.params.item;
  const place = it.place_id ? PLACES.find((p) => p.id === it.place_id) : null;
  const d = DESTINATIONS.find((x) => x.id === (place?.destination || it.city_id));
  return (
    <Screen padded={false} header={<Header transparent onBack={() => navigation.goBack()} />}>
      <Photo photo={place ? place.photo || `place:${place.id}` : `dest:${d?.id}`} art={d?.art} rounded={0} style={{ height: 320, justifyContent: 'flex-end', padding: space.xl }} iconSize={180}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Badge label={it.category_label} tone="white" icon={CAT_ICON[it.category]} />
          {it.booking_status_label ? <Badge label={it.booking_status_label} tone={BOOKING_TONE[it.booking_status]} /> : null}
        </View>
        <T v="h1" color={colors.white} style={{ marginTop: 10 }}>
          {it.title}
        </T>
      </Photo>
      <View style={{ padding: space.xl }}>
        <Card>
          <InfoRow icon="calendar" label="Quando" value={`${longDate(it.date)}${it.start_time ? ` · ${it.start_time}${it.end_time ? ` às ${it.end_time}` : ''}` : ''}`} />
          <InfoRow icon="map-pin-line" label="Onde" value={it.address} />
          <InfoRow icon="receipt" label="Confirmação" value={it.confirmation_code} last />
        </Card>
        {it.description ? (
          <View style={{ marginTop: space.lg }}>
            <Tip title="O que você precisa saber">{it.description}</Tip>
          </View>
        ) : null}
        <View style={{ gap: 10, marginTop: space.xl }}>
          {it.address ? <Button title="Abrir no mapa" icon="map-trifold" url={it.maps_url} /> : null}
          {place ? <Button title={`Saiba mais sobre ${place.name}`} variant="secondary" icon="compass" onPress={() => navigation.navigate('Place', { id: place.id })} /> : null}
          {it.booking_status === 'pendente' ? <Button title="Falar com a Vagari sobre isso" variant="whatsapp" icon="chat-teardrop-dots" onPress={() => navigation.navigate('Help')} /> : null}
        </View>
      </View>
    </Screen>
  );
}

export { useMemo };
