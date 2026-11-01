/** Explorar: indicações da Vagari, busca, categorias, perto do hotel, favoritos, lugar e inspiração. */
import React, { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Badge, Button, Card, Chip, EmptyState, Header, Icon, IconButton, Input, Loading, Photo, Screen, Section, T, Tip, colors, radius, space } from '../components/ui';
import { useApp, useLoad } from '../lib/state';
import { PlaceTile } from './home';

const CAT_ICON = { ponto_turistico: 'castle-turret', museu_cultura: 'bank', restaurante: 'fork-knife', cafe: 'coffee', bar: 'cheers', experiencia: 'confetti', compras: 'shopping-bag', servicos: 'info' };

export function ExploreScreen({ navigation }) {
  const { api, tripId } = useApp();
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState('');
  const [category, setCategory] = useState(null);
  const [near, setNear] = useState(false);
  const guide = useLoad(() => (tripId ? api.guide(tripId, { q, category, near: near ? 'hotel' : null }) : null), [tripId, q, category, near]);
  const inspo = useLoad(() => api.inspiration(), []);
  const places = guide.data?.places || [];
  const highlights = places.filter((p) => p.highlight);
  const rest = places.filter((p) => !p.highlight || q || category);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.bg }} contentContainerStyle={{ paddingTop: insets.top + 12, paddingBottom: 140 + insets.bottom }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
      <View style={{ paddingHorizontal: space.xl }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flex: 1 }}>
            <T v="h1">Explorar</T>
            <T v="small">{tripId ? 'Dicas escolhidas a dedo pro seu destino' : 'Inspiração pra próxima viagem'}</T>
          </View>
          <IconButton icon="heart" weight="duotone" color={colors.purple600} onPress={() => navigation.navigate('Favorites')} accessibilityLabel="Favoritos" />
        </View>
        {tripId ? <Input icon="magnifying-glass" placeholder="Busca um lugar, museu, praia…" value={q} onChangeText={setQ} style={{ marginTop: 16 }} returnKeyType="search" /> : null}
      </View>

      {tripId ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: space.xl, paddingVertical: 14, gap: 8 }}>
            <Chip label="Perto do hotel" icon="bed" active={near} tone="orange" onPress={() => setNear(!near)} />
            <Chip label="Tudo" active={!category} onPress={() => setCategory(null)} />
            {(guide.data?.categories || []).map((c) => (
              <Chip key={c.key} label={c.label} icon={CAT_ICON[c.key]} active={category === c.key} onPress={() => setCategory(category === c.key ? null : c.key)} />
            ))}
          </ScrollView>

          {guide.loading ? <Loading /> : null}

          {!q && !category && highlights.length ? (
            <View style={{ paddingHorizontal: space.xl }}>
              <Section title="Indicações da Vagari" style={{ marginTop: 4 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl }} contentContainerStyle={{ paddingHorizontal: space.xl, gap: 12 }}>
                  {highlights.map((p) => (
                    <Pressable key={p.id} onPress={() => navigation.navigate('Place', { id: p.id })} style={{ width: 290 }}>
                      <Photo photo={p.photo} art={p.art} style={{ height: 300, padding: 16, justifyContent: 'space-between' }} rounded={radius.xl} iconSize={150}>
                        <Badge label="Indicação Vagari" tone="solidOrange" icon="seal-check" />
                        <View>
                          <T v="h2" color={colors.white}>
                            {p.name}
                          </T>
                          <T v="small" color="rgba(255,255,255,0.9)" numberOfLines={2} style={{ marginTop: 4 }}>
                            “{p.highlight_note}”
                          </T>
                        </View>
                      </Photo>
                    </Pressable>
                  ))}
                </ScrollView>
              </Section>
            </View>
          ) : null}

          <View style={{ paddingHorizontal: space.xl }}>
            <Section title={near && guide.data?.near_hotel ? `Perto do ${guide.data.near_hotel.name}` : q ? `Resultados pra “${q}”` : 'Pra conhecer'}>
              {!guide.loading && !rest.length ? <EmptyState icon="magnifying-glass" title="Nada por aqui" text="Tenta outra palavra ou tira o filtro." /> : null}
              <View style={{ gap: 12 }}>
                {rest.map((p) => (
                  <PlaceRow key={p.id} p={p} onPress={() => navigation.navigate('Place', { id: p.id })} />
                ))}
              </View>
            </Section>
          </View>
        </>
      ) : null}

      <View style={{ paddingHorizontal: space.xl }}>
        <Section title="Inspire-se pra próxima">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl }} contentContainerStyle={{ paddingHorizontal: space.xl, gap: 12 }}>
            {(inspo.data?.destinations || []).map((d) => (
              <Pressable key={d.id} onPress={() => navigation.navigate('Destination', { id: d.id })} style={{ width: 160 }}>
                <Photo photo={d.photo || `dest:${d.id}`} art={d.art} style={{ height: 210, padding: 12, justifyContent: 'flex-end' }} rounded={radius.lg} iconSize={90}>
                  <T v="title" color={colors.white}>
                    {d.name}
                  </T>
                  <T v="small" color="rgba(255,255,255,0.85)" numberOfLines={2}>
                    {d.tagline}
                  </T>
                </Photo>
              </Pressable>
            ))}
          </ScrollView>
        </Section>
      </View>
    </ScrollView>
  );
}

export function PlaceRow({ p, onPress }) {
  return (
    <Card onPress={onPress} padded={false} style={{ flexDirection: 'row', overflow: 'hidden' }}>
      <Photo photo={p.photo} art={p.art} style={{ width: 108, minHeight: 112 }} rounded={0} overlay={false} iconSize={70} />
      <View style={{ flex: 1, padding: 14, gap: 4 }}>
        <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
          <T v="caption" color={colors.purple600}>
            {p.category_label}
          </T>
          {p.highlight ? <Icon name="seal-check" size={14} color={colors.orange500} weight="fill" /> : null}
        </View>
        <T v="title" numberOfLines={1}>
          {p.name}
        </T>
        <T v="small" numberOfLines={2}>
          {p.short_description}
        </T>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 2 }}>
          {p.distance_km !== null && p.distance_km !== undefined ? (
            <T v="smallStrong" color={colors.orange600}>
              {String(p.distance_km).replace('.', ',')} km do hotel
            </T>
          ) : null}
          {p.is_favorite ? <Icon name="heart" size={16} color={colors.danger} weight="fill" /> : null}
        </View>
      </View>
    </Card>
  );
}

export function PlaceScreen({ navigation, route }) {
  const { api, showToast, refresh } = useApp();
  const insets = useSafeAreaInsets();
  const res = useLoad(() => api.place(route.params.id), [route.params.id]);
  const [fav, setFav] = useState(null);
  if (res.loading || !res.data) return <Loading />;
  const p = res.data.place;
  const isFav = fav ?? p.is_favorite;
  const toggle = async () => {
    setFav(!isFav);
    await api.setFavorite(p.id, !isFav);
    showToast(!isFav ? 'Salvo nos favoritos 💜' : 'Tirado dos favoritos');
    refresh();
  };
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <Photo photo={p.photo} art={p.art} rounded={0} style={{ height: 420, justifyContent: 'flex-end', padding: space.xl, paddingBottom: 44 }} iconSize={220}>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <Badge label={p.category_label} tone="white" icon={CAT_ICON[p.category]} />
            <Badge label={p.destination_name} tone="glass" icon="map-pin-simple" />
          </View>
          <T v="big" color={colors.white} style={{ marginTop: 10 }}>
            {p.name}
          </T>
        </Photo>
        <View style={{ marginTop: -28, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.xl }}>
          {p.highlight_note ? (
            <View style={{ padding: space.lg, borderRadius: radius.lg, backgroundColor: colors.orange50, flexDirection: 'row', gap: 12, marginBottom: space.lg }}>
              <Icon name="seal-check" size={26} color={colors.orange500} weight="fill" />
              <View style={{ flex: 1 }}>
                <T v="smallStrong">Indicação da Vagari</T>
                <T v="body">{p.highlight_note}</T>
              </View>
            </View>
          ) : null}
          <T v="body" style={{ fontSize: 16, lineHeight: 24 }}>
            {p.short_description}
          </T>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
            {p.tags.map((t) => (
              <Badge key={t} label={`#${t}`} tone="purple" />
            ))}
          </View>
          <Card style={{ marginTop: space.xl }}>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <Icon name="map-pin-line" size={22} color={colors.purple600} weight="duotone" />
              <View style={{ flex: 1 }}>
                <T v="caption">Endereço</T>
                <T v="bodyStrong" selectable>
                  {p.address}
                </T>
              </View>
            </View>
          </Card>
          <T v="small" style={{ marginTop: 12 }}>
            Informação revisada pela Vagari em {p.last_verified_at.split('-').reverse().join('/')}. Horários e preços mudam: confere no site oficial antes de ir.
          </T>
          <View style={{ gap: 10, marginTop: space.xl }}>
            <Button title="Abrir no mapa" icon="map-trifold" url={p.maps_url} />
            {p.official_url ? <Button title="Site oficial" icon="arrow-square-out" variant="secondary" url={p.official_url} /> : null}
          </View>
          {p.nearby?.length ? (
            <Section title="Aqui pertinho também">
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginHorizontal: -space.xl }} contentContainerStyle={{ paddingHorizontal: space.xl, gap: 12 }}>
                {p.nearby.map((n) => (
                  <PlaceTile key={n.id} p={n} width={170} onPress={() => navigation.push('Place', { id: n.id })} />
                ))}
              </ScrollView>
            </Section>
          ) : null}
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', top: insets.top + 8, left: space.lg, right: space.lg, flexDirection: 'row', justifyContent: 'space-between' }}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} bg="rgba(255,255,255,0.92)" accessibilityLabel="Voltar" />
        <IconButton icon="heart" weight={isFav ? 'fill' : 'regular'} color={isFav ? colors.danger : colors.ink} onPress={toggle} bg="rgba(255,255,255,0.92)" accessibilityLabel={isFav ? 'Tirar dos favoritos' : 'Salvar nos favoritos'} />
      </View>
    </View>
  );
}

export function FavoritesScreen({ navigation }) {
  const { api } = useApp();
  const res = useLoad(() => api.favorites(), []);
  const places = res.data?.places || [];
  return (
    <Screen header={<Header title="Seus favoritos" onBack={() => navigation.goBack()} />}>
      {res.loading ? <Loading /> : null}
      {!res.loading && !places.length ? <EmptyState icon="heart" title="Nada salvo ainda" text="Toca no coração dos lugares que você curtir e eles ficam guardados aqui." /> : null}
      <View style={{ gap: 12, marginTop: 8 }}>
        {places.map((p) => (
          <PlaceRow key={p.id} p={p} onPress={() => navigation.navigate('Place', { id: p.id })} />
        ))}
      </View>
    </Screen>
  );
}

/** Destino da biblioteca (inspiração): vitrine pra próxima viagem, com papo direto no WhatsApp. */
export function DestinationScreen({ navigation, route }) {
  const { api } = useApp();
  const insets = useSafeAreaInsets();
  const res = useLoad(() => api.destination(route.params.id), [route.params.id]);
  if (res.loading || !res.data) return <Loading />;
  const { destination: d, places, whatsapp_url } = res.data;
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 130 + insets.bottom }} showsVerticalScrollIndicator={false}>
        <Photo photo={d.photo || `dest:${d.id}`} art={d.art} rounded={0} style={{ height: 460, justifyContent: 'flex-end', padding: space.xl, paddingBottom: 44 }} iconSize={240}>
          <T v="caption" color={colors.orange300}>
            {d.country}
          </T>
          <T v="big" color={colors.white} style={{ marginTop: 6 }}>
            {d.name}
          </T>
          <T v="bodyStrong" color="rgba(255,255,255,0.9)" style={{ marginTop: 6 }}>
            {d.tagline}
          </T>
        </Photo>
        <View style={{ marginTop: -28, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: space.xl }}>
          <T v="body" style={{ fontSize: 16, lineHeight: 24 }}>
            {d.overview}
          </T>
          {d.best_season ? (
            <View style={{ marginTop: space.lg }}>
              <Tip icon="cloud-sun" title="Melhor época" tone="purple">
                {d.best_season}
              </Tip>
            </View>
          ) : null}
          <Section title="Não dá pra perder">
            <View style={{ gap: 12 }}>
              {places.map((p) => (
                <PlaceRow key={p.id} p={p} onPress={() => navigation.push('Place', { id: p.id })} />
              ))}
            </View>
          </Section>
        </View>
      </ScrollView>
      <View style={{ position: 'absolute', top: insets.top + 8, left: space.lg }}>
        <IconButton icon="arrow-left" onPress={() => navigation.goBack()} bg="rgba(255,255,255,0.92)" accessibilityLabel="Voltar" />
      </View>
      <View style={{ position: 'absolute', left: space.xl, right: space.xl, bottom: insets.bottom + 20 }}>
        <Button title={`Quero ir pra ${d.name}!`} variant="accent" icon="chat-teardrop-dots" url={whatsapp_url} />
      </View>
    </View>
  );
}
