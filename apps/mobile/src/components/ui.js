/**
 * Componentes do design system Vagari (React Native).
 * Tudo vem dos tokens em shared/tokens.js — mudou a marca, muda lá.
 */
import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, ImageBackground, Linking, Switch } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, type, radius, shadow, space } from '../../../../shared/tokens.js';
import ICONS from '../../../../shared/icons.json';
import { PHOTOS } from '../lib/photos';

export { colors, fonts, radius, space, shadow };

// ------------------------------------------------------------------ ícones (Lucevias, MIT)
export function Icon({ name, size = 22, color = colors.ink, weight = 'regular', accent = colors.orange500, style }) {
  const icon = ICONS[name];
  if (!icon) return <View style={{ width: size, height: size }} />;
  const els = icon[weight] || icon.regular;
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" style={style}>
      {els.map((e, i) => (
        <Path key={i} d={e.d} fill={e.a ? accent : color} opacity={e.opacity ? Number(e.opacity) : e.a && weight === 'duotone' ? 0.9 : 1} fillRule={e.fr} clipRule={e.fr} />
      ))}
    </Svg>
  );
}

// ------------------------------------------------------------------ texto
const VARIANTS = {
  h1: { fontFamily: fonts.display, ...type.h1, color: colors.ink },
  h2: { fontFamily: fonts.display, ...type.h2, color: colors.ink },
  h3: { fontFamily: fonts.displaySemi, ...type.h3, color: colors.ink },
  title: { fontFamily: fonts.bodyBold, fontSize: 16, lineHeight: 21, color: colors.ink },
  body: { fontFamily: fonts.body, ...type.body, color: colors.inkSoft },
  bodyStrong: { fontFamily: fonts.bodySemi, ...type.body, color: colors.ink },
  small: { fontFamily: fonts.bodyMedium, ...type.bodySm, color: colors.muted },
  smallStrong: { fontFamily: fonts.bodyBold, ...type.bodySm, color: colors.ink },
  caption: { fontFamily: fonts.bodyBold, ...type.caption, color: colors.muted, textTransform: 'uppercase' },
  big: { fontFamily: fonts.display, fontSize: 44, lineHeight: 46, letterSpacing: -1, color: colors.ink },
};
export function T({ v = 'body', color, style, center, children, ...rest }) {
  return (
    <Text style={[VARIANTS[v], color && { color }, center && { textAlign: 'center' }, style]} {...rest}>
      {children}
    </Text>
  );
}

// ------------------------------------------------------------------ links externos
/** No celular abre o app (WhatsApp, Mapas); na web vira um link <a> comum. */
export function openExternal(url) {
  if (!url) return;
  if (Platform.OS === 'web') {
    const w = window.open(url, '_blank', 'noopener');
    return !!w;
  }
  Linking.openURL(url);
  return true;
}
const webLink = (url) => (Platform.OS === 'web' && url ? { href: url, hrefAttrs: { target: '_blank', rel: 'noopener' } } : {});

// ------------------------------------------------------------------ botões
export function Button({ title, onPress, variant = 'primary', icon, iconRight, small, full = true, disabled, loading, url, style }) {
  const v = BTN[variant];
  return (
    <Pressable
      accessibilityRole={url ? 'link' : 'button'}
      onPress={url && Platform.OS !== 'web' ? () => openExternal(url) : onPress}
      disabled={disabled || loading}
      {...webLink(url)}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: v.bg, borderColor: v.border || v.bg },
        small && styles.btnSmall,
        full && { alignSelf: 'stretch' },
        (disabled || loading) && { opacity: 0.5 },
        pressed && { transform: [{ scale: 0.98 }], opacity: 0.92 },
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={small ? 18 : 20} color={v.fg} weight={v.weight || 'regular'} accent={v.accent} /> : null}
      <Text style={[styles.btnText, { color: v.fg }, small && { fontSize: 14 }]}>{loading ? 'Só um instante…' : title}</Text>
      {iconRight ? <Icon name={iconRight} size={18} color={v.fg} /> : null}
    </Pressable>
  );
}
const BTN = {
  primary: { bg: colors.purple600, fg: colors.white },
  accent: { bg: colors.orange500, fg: colors.ink },
  secondary: { bg: colors.purple50, fg: colors.purple700 },
  outline: { bg: 'transparent', fg: colors.purple700, border: colors.purple200 },
  ghost: { bg: 'transparent', fg: colors.purple700 },
  light: { bg: colors.white, fg: colors.purple700 },
  dark: { bg: colors.black, fg: colors.white },
  whatsapp: { bg: colors.whatsapp, fg: '#06341C', weight: 'fill' },
  glass: { bg: 'rgba(255,255,255,0.18)', fg: colors.white, border: 'rgba(255,255,255,0.35)' },
};

export function IconButton({ icon, onPress, color = colors.ink, bg = colors.surface, size = 44, badge, weight, accessibilityLabel, style }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={6}
      style={({ pressed }) => [{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }, pressed && { opacity: 0.7 }, style]}
    >
      <Icon name={icon} size={size * 0.5} color={color} weight={weight} />
      {badge ? (
        <View style={styles.badgeDot}>
          <Text style={styles.badgeDotText}>{badge}</Text>
        </View>
      ) : null}
    </Pressable>
  );
}

// ------------------------------------------------------------------ chips, selos
export function Chip({ label, active, icon, onPress, tone = 'purple', style }) {
  const on = active;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!on }}
      style={({ pressed }) => [styles.chip, on ? { backgroundColor: tone === 'orange' ? colors.orange500 : colors.purple600, borderColor: 'transparent' } : null, pressed && { opacity: 0.8 }, style]}
    >
      {icon ? <Icon name={icon} size={16} color={on ? (tone === 'orange' ? colors.ink : colors.white) : colors.purple600} weight={on ? 'fill' : 'regular'} /> : null}
      <Text style={[styles.chipText, on && { color: tone === 'orange' ? colors.ink : colors.white }]}>{label}</Text>
    </Pressable>
  );
}

const TONES = {
  purple: [colors.purple50, colors.purple700],
  orange: [colors.orange50, colors.orange600],
  green: [colors.successBg, colors.success],
  yellow: [colors.warningBg, colors.warning],
  red: [colors.dangerBg, colors.danger],
  white: ['rgba(255,255,255,0.92)', colors.purple700],
  solidOrange: [colors.orange500, colors.ink],
  glass: ['rgba(255,255,255,0.2)', colors.white],
};
export function Badge({ label, tone = 'purple', icon, style }) {
  const [bg, fg] = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: bg }, style]}>
      {icon ? <Icon name={icon} size={13} color={fg} weight="fill" /> : null}
      <Text style={[styles.badgeText, { color: fg }]}>{label}</Text>
    </View>
  );
}

// ------------------------------------------------------------------ superfícies
export function Card({ children, style, onPress, padded = true, tone }) {
  const bg = tone === 'purple' ? colors.purple600 : tone === 'soft' ? colors.purple50 : tone === 'orange' ? colors.orange50 : colors.surface;
  const content = <View style={[styles.card, { backgroundColor: bg }, padded && { padding: space.lg }, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && { transform: [{ scale: 0.985 }], opacity: 0.95 }}>
      {content}
    </Pressable>
  );
}

export function Section({ title, action, onAction, children, style }) {
  return (
    <View style={[{ marginTop: space.xxl }, style]}>
      <View style={styles.sectionHead}>
        <T v="h3">{title}</T>
        {action ? (
          <Pressable onPress={onAction} hitSlop={8}>
            <T v="smallStrong" color={colors.purple600}>
              {action}
            </T>
          </Pressable>
        ) : null}
      </View>
      {children}
    </View>
  );
}

/**
 * Foto grande (destino/lugar). Enquanto a foto real não chega, desenha uma capa
 * ilustrada com as cores do destino e um ícone grande — nunca fica um buraco cinza.
 */
export function Photo({ photo, art, style, children, rounded = radius.xl, overlay = true, iconSize = 140 }) {
  const src = photo && PHOTOS[photo];
  const a = art || { colors: [colors.purple500, colors.purple800], icon: 'globe-hemisphere-west' };
  const inner = (
    <>
      {overlay ? <LinearGradient colors={['rgba(34,16,79,0)', 'rgba(34,16,79,0.15)', 'rgba(34,16,79,0.82)']} locations={[0.35, 0.55, 1]} style={StyleSheet.absoluteFill} /> : null}
      {children}
    </>
  );
  if (src) {
    return (
      <ImageBackground source={src} style={[{ overflow: 'hidden', borderRadius: rounded }, style]} resizeMode="cover">
        {inner}
      </ImageBackground>
    );
  }
  return (
    <View style={[{ overflow: 'hidden', borderRadius: rounded, backgroundColor: a.colors[0] }, style]}>
      <LinearGradient colors={a.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={[styles.artCircle, { width: iconSize * 2.2, height: iconSize * 2.2, borderRadius: iconSize * 1.1, right: -iconSize * 0.7, top: -iconSize * 0.6 }]} />
      <View style={[styles.artCircle, { width: iconSize * 1.2, height: iconSize * 1.2, borderRadius: iconSize, left: -iconSize * 0.4, bottom: -iconSize * 0.3, opacity: 0.08 }]} />
      <Icon name={a.icon} size={iconSize} color="rgba(255,255,255,0.16)" weight="duotone" accent="rgba(255,255,255,0.26)" style={{ position: 'absolute', right: iconSize * 0.12, top: iconSize * 0.18 }} />
      {inner}
    </View>
  );
}

export function ProgressRing({ percent = 0, size = 64, stroke = 7, color = colors.orange500, track = colors.purple100, children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={track} strokeWidth={stroke} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={`${c} ${c}`}
          strokeDashoffset={c * (1 - Math.min(percent, 100) / 100)}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      {children}
    </View>
  );
}

export function ProgressBar({ percent, color = colors.orange500, track = colors.purple100, height = 8 }) {
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: `${Math.min(percent, 100)}%`, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

// ------------------------------------------------------------------ telas
export function Screen({ children, scroll = true, padded = true, bg = colors.bg, header, contentStyle, bottomSpace = 120, refreshControl }) {
  const insets = useSafeAreaInsets();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={[padded && { paddingHorizontal: space.xl }, { paddingBottom: bottomSpace + insets.bottom }, contentStyle]}
      showsVerticalScrollIndicator={false}
      refreshControl={refreshControl}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[{ flex: 1 }, padded && { paddingHorizontal: space.xl }, contentStyle]}>{children}</View>
  );
  return (
    <View style={{ flex: 1, backgroundColor: bg }}>
      {header}
      {body}
    </View>
  );
}

/** Cabeçalho das telas internas: voltar + título + ação. */
export function Header({ title, onBack, right, transparent, subtitle, light }) {
  const insets = useSafeAreaInsets();
  const fg = light ? colors.white : colors.ink;
  return (
    <View style={[styles.header, { paddingTop: insets.top + 8 }, transparent && { position: 'absolute', left: 0, right: 0, zIndex: 10, backgroundColor: 'transparent' }]}>
      {onBack ? (
        <IconButton icon="arrow-left" onPress={onBack} bg={light || transparent ? 'rgba(255,255,255,0.92)' : colors.surface} color={colors.ink} size={42} accessibilityLabel="Voltar" />
      ) : (
        <View style={{ width: 42 }} />
      )}
      <View style={{ flex: 1, alignItems: 'center', paddingHorizontal: 8 }}>
        {title ? (
          <T v="title" color={fg} numberOfLines={1}>
            {title}
          </T>
        ) : null}
        {subtitle ? (
          <T v="small" color={light ? 'rgba(255,255,255,0.8)' : colors.muted} numberOfLines={1}>
            {subtitle}
          </T>
        ) : null}
      </View>
      {right || <View style={{ width: 42 }} />}
    </View>
  );
}

export function ListRow({ icon, iconTone = 'purple', title, subtitle, right, onPress, last, url }) {
  const [bg, fg] = TONES[iconTone] || TONES.purple;
  return (
    <Pressable
      onPress={url && Platform.OS !== 'web' ? () => openExternal(url) : onPress}
      {...webLink(url)}
      style={({ pressed }) => [styles.row, !last && styles.rowLine, pressed && (onPress || url) && { opacity: 0.6 }]}
    >
      {icon ? (
        <View style={[styles.rowIcon, { backgroundColor: bg }]}>
          <Icon name={icon} size={20} color={fg} weight="duotone" accent={colors.orange500} />
        </View>
      ) : null}
      <View style={{ flex: 1 }}>
        <T v="bodyStrong" numberOfLines={2}>
          {title}
        </T>
        {subtitle ? <T v="small">{subtitle}</T> : null}
      </View>
      {right !== undefined ? right : onPress || url ? <Icon name="caret-right" size={18} color={colors.muted} /> : null}
    </Pressable>
  );
}

export function Toggle({ value, onValueChange }) {
  return <Switch value={value} onValueChange={onValueChange} trackColor={{ true: colors.purple500, false: colors.lineStrong }} thumbColor={colors.white} />;
}

export function Input({ label, icon, style, inputStyle, ...props }) {
  return (
    <View style={style}>
      {label ? (
        <T v="smallStrong" style={{ marginBottom: 6 }}>
          {label}
        </T>
      ) : null}
      <View style={styles.input}>
        {icon ? <Icon name={icon} size={20} color={colors.muted} /> : null}
        <TextInput placeholderTextColor={colors.muted} style={[styles.inputText, inputStyle]} {...props} />
      </View>
    </View>
  );
}

export function EmptyState({ icon = 'compass', title, text, action, onAction }) {
  return (
    <View style={{ alignItems: 'center', paddingVertical: 48, paddingHorizontal: 24 }}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={40} color={colors.purple600} weight="duotone" />
      </View>
      <T v="h3" center style={{ marginTop: 16 }}>
        {title}
      </T>
      {text ? (
        <T v="body" center style={{ marginTop: 6 }}>
          {text}
        </T>
      ) : null}
      {action ? <Button title={action} onPress={onAction} style={{ marginTop: 20 }} full={false} /> : null}
    </View>
  );
}

export function Loading() {
  const v = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const a = Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 600, useNativeDriver: true }), Animated.timing(v, { toValue: 0.4, duration: 600, useNativeDriver: true })]));
    a.start();
    return () => a.stop();
  }, [v]);
  return (
    <View style={{ padding: space.xl, gap: 14 }}>
      {[180, 90, 120].map((h, i) => (
        <Animated.View key={i} style={{ height: h, borderRadius: radius.lg, backgroundColor: colors.purple100, opacity: v }} />
      ))}
    </View>
  );
}

/** Cartão de aviso no estilo "papo de amigo". */
export function Tip({ icon = 'lightbulb', title, children, tone = 'orange' }) {
  const bg = tone === 'orange' ? colors.orange50 : colors.purple50;
  return (
    <View style={[styles.tip, { backgroundColor: bg }]}>
      <Icon name={icon} size={24} color={tone === 'orange' ? colors.orange600 : colors.purple600} weight="duotone" accent={tone === 'orange' ? colors.orange500 : colors.purple300} />
      <View style={{ flex: 1 }}>
        {title ? <T v="smallStrong">{title}</T> : null}
        <T v="small" color={colors.inkSoft}>
          {children}
        </T>
      </View>
    </View>
  );
}

export const styles = StyleSheet.create({
  btn: { minHeight: 54, borderRadius: radius.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 22, borderWidth: 1.5 },
  btnSmall: { minHeight: 42, paddingHorizontal: 16 },
  btnText: { fontFamily: fonts.bodyBold, fontSize: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, height: 38, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line },
  chipText: { fontFamily: fonts.bodySemi, fontSize: 14, color: colors.inkSoft },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill, alignSelf: 'flex-start' },
  badgeText: { fontFamily: fonts.bodyBold, fontSize: 12 },
  badgeDot: { position: 'absolute', top: 4, right: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: colors.orange500, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4, borderWidth: 2, borderColor: colors.white },
  badgeDotText: { fontFamily: fonts.bodyBold, fontSize: 10, color: colors.ink },
  card: { borderRadius: radius.lg, ...shadow.card },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.md },
  artCircle: { position: 'absolute', backgroundColor: 'rgba(255,255,255,0.1)' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.lg, paddingBottom: 10, backgroundColor: colors.bg },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  rowLine: { borderBottomWidth: 1, borderBottomColor: colors.line },
  rowIcon: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  input: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 54, borderRadius: radius.md, borderWidth: 1.5, borderColor: colors.line, backgroundColor: colors.surface, paddingHorizontal: 16 },
  inputText: { flex: 1, fontFamily: fonts.bodyMedium, fontSize: 16, color: colors.ink, paddingVertical: 12, outlineStyle: 'none' },
  emptyIcon: { width: 88, height: 88, borderRadius: 44, backgroundColor: colors.purple50, alignItems: 'center', justifyContent: 'center' },
  tip: { flexDirection: 'row', gap: 12, padding: space.lg, borderRadius: radius.lg, alignItems: 'flex-start' },
});
