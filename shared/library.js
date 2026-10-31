/**
 * Biblioteca inicial de destinos e lugares (pontos turísticos clássicos).
 *
 * Status: PENDENTE DE REVISÃO HUMANA. Montada sem acesso à internet neste ambiente,
 * a partir de conhecimento geral: nomes, endereços e coordenadas aproximadas de pontos
 * muito conhecidos. Sem horários e sem preços (não verificados). Links oficiais só onde
 * houve segurança; os demais ficam em branco para a equipe completar.
 *
 * `photo` é o nome do arquivo esperado em assets/photos (ver docs/FOTOS.md).
 * `art` define a capa ilustrada usada enquanto a foto não chega.
 */

const D = (id, country, city, extra = {}) => ({ id, country, city: city || null, ...extra });

export const DESTINATIONS = [
  D('brasil', 'Brasil', null, { timezone: 'America/Sao_Paulo' }),
  D('rio', 'Brasil', 'Rio de Janeiro', { parent: 'brasil', region: 'RJ', timezone: 'America/Sao_Paulo', tagline: 'Cartão-postal que não cansa nunca', overview: 'Praia, morro e samba no mesmo rolê. A Cidade Maravilhosa é aquele clássico que sempre surpreende.', best_season: 'Ano todo; dezembro a março é alta temporada', photo: 'rio.jpg', art: { colors: ['#14A06B', '#4B134B'], icon: 'sun' } }),
  D('franca', 'França', null, { timezone: 'Europe/Paris' }),
  D('paris', 'França', 'Paris', { parent: 'franca', region: 'Île-de-France', timezone: 'Europe/Paris', tagline: 'A Cidade Luz te espera', overview: 'Café na calçada, museu de cair o queixo e a Torre brilhando à noite. Paris é pra viver sem pressa.', best_season: 'Abril a junho; setembro a outubro', photo: 'paris.jpg', art: { colors: ['#6D1660', '#F77A10'], icon: 'castle-turret' } }),
  D('reino-unido', 'Reino Unido', null, { timezone: 'Europe/London' }),
  D('londres', 'Reino Unido', 'Londres', { parent: 'reino-unido', region: 'Inglaterra', timezone: 'Europe/London', tagline: 'Clássica, moderna e cheia de vibe', overview: 'Da realeza aos mercadinhos de Camden, Londres mistura história e cena cultural como ninguém.', best_season: 'Maio a setembro', photo: 'londres-cabines.jpg', art: { colors: ['#3C0328', '#D9354F'], icon: 'clock' } }),
  D('estados-unidos', 'Estados Unidos', null, { timezone: 'America/New_York' }),
  D('orlando', 'Estados Unidos', 'Orlando', { parent: 'estados-unidos', region: 'Flórida', timezone: 'America/New_York', tagline: 'Disney, parques e muita diversão', overview: 'Capital mundial dos parques: Disney, Universal e diversão pra todas as idades.', best_season: 'Março a maio; outubro a novembro', photo: 'disney.jpg', art: { colors: ['#2D6BE0', '#6D1660'], icon: 'castle-turret' } }),
  D('nova-york', 'Estados Unidos', 'Nova York', { parent: 'estados-unidos', region: 'NY', timezone: 'America/New_York', tagline: 'A cidade que nunca dorme', overview: 'Arranha-céus, Central Park e um rolê novo em cada esquina.', best_season: 'Abril a junho; setembro a novembro', photo: 'nova-york.jpg', art: { colors: ['#2A0220', '#F77A10'], icon: 'buildings' } }),
  D('peru', 'Peru', null, { timezone: 'America/Lima' }),
  D('machu-picchu', 'Peru', 'Machu Picchu', { parent: 'peru', region: 'Cusco', timezone: 'America/Lima', tagline: 'A cidade perdida dos incas', overview: 'Montanhas, nuvens e ruínas incas: Machu Picchu é daqueles lugares que mudam a gente.', best_season: 'Maio a setembro (estação seca)', photo: 'machu-picchu.jpg', art: { colors: ['#14A06B', '#3C0328'], icon: 'footprints' } }),
  D('chile', 'Chile', null, { timezone: 'America/Santiago' }),
  D('ilha-de-pascoa', 'Chile', 'Ilha de Páscoa', { parent: 'chile', region: 'Rapa Nui', timezone: 'Pacific/Easter', tagline: 'Os moais e o fim do mundo', overview: 'Ilha remota no Pacífico, famosa pelos moais gigantes e pores do sol de outro planeta.', best_season: 'Outubro a abril', photo: 'ilha-de-pascoa.jpg', art: { colors: ['#F77A10', '#54073D'], icon: 'waves' } }),
  D('china', 'China', null, { timezone: 'Asia/Shanghai' }),
  D('pequim', 'China', 'Pequim', { parent: 'china', timezone: 'Asia/Shanghai', tagline: 'Porta de entrada pra Muralha da China', overview: 'Muralha, Cidade Proibida e templos milenares: Pequim é história em escala gigante.', best_season: 'Abril a maio; setembro a outubro', photo: 'pequim-beihai.jpg', art: { colors: ['#D9354F', '#3C0328'], icon: 'flag-banner' } }),
  D('italia', 'Itália', null, { timezone: 'Europe/Rome', tagline: 'Dolce vita de norte a sul', photo: 'italia-comida.jpg', art: { colors: ['#F77A10', '#4B134B'], icon: 'bank' } }),
  D('roma', 'Itália', 'Roma', { parent: 'italia', region: 'Lácio', timezone: 'Europe/Rome', tagline: 'Um museu a céu aberto', overview: 'Coliseu, fontes, massas e gelato. Em Roma cada esquina tem 2 mil anos de história.', best_season: 'Abril a junho; setembro a outubro', photo: 'roma-trevi.jpg', art: { colors: ['#F77A10', '#6D1660'], icon: 'bank' } }),
  D('florenca', 'Itália', 'Florença', { parent: 'italia', region: 'Toscana', timezone: 'Europe/Rome', tagline: 'Berço do Renascimento', overview: 'Arte por todo lado, vinho da Toscana e o pôr do sol na Ponte Vecchio.', best_season: 'Abril a junho; setembro a outubro', photo: 'florenca.jpg', art: { colors: ['#D45F0A', '#54073D'], icon: 'church' } }),
  D('veneza', 'Itália', 'Veneza', { parent: 'italia', region: 'Vêneto', timezone: 'Europe/Rome', tagline: 'Canais, gôndolas e romance', overview: 'Uma cidade inteira sobre a água. Se perder pelas vielas é obrigatório.', best_season: 'Abril a junho; setembro a outubro', photo: 'veneza.jpg', art: { colors: ['#2D6BE0', '#F77A10'], icon: 'boat' } }),
  D('grecia', 'Grécia', null, { timezone: 'Europe/Athens' }),
  D('atenas', 'Grécia', 'Atenas', { parent: 'grecia', region: 'Ática', timezone: 'Europe/Athens', tagline: 'Onde tudo começou', overview: 'A Acrópole lá no alto e tavernas cheias de vida embaixo.', best_season: 'Abril a junho; setembro a outubro', photo: 'atenas.jpg', art: { colors: ['#2D6BE0', '#6D1660'], icon: 'bank' } }),
  D('santorini', 'Grécia', 'Santorini', { parent: 'grecia', region: 'Cíclades', timezone: 'Europe/Athens', tagline: 'Casinhas brancas e mar azulzão', overview: 'O pôr do sol mais famoso do mundo, em cima de um vulcão.', best_season: 'Maio a outubro', photo: 'santorini-oia.jpg', art: { colors: ['#2D6BE0', '#F77A10'], icon: 'sun' } }),
  D('espanha', 'Espanha', null, { timezone: 'Europe/Madrid' }),
  D('barcelona', 'Espanha', 'Barcelona', { parent: 'espanha', region: 'Catalunha', timezone: 'Europe/Madrid', tagline: 'Gaudí, praia e tapas', overview: 'Arquitetura que parece sonho, praia urbana e noite que não acaba.', best_season: 'Maio a junho; setembro a outubro', photo: 'barcelona-sagrada.jpg', art: { colors: ['#F77A10', '#D9354F'], icon: 'church' } }),
  D('madri', 'Espanha', 'Madri', { parent: 'espanha', region: 'Comunidade de Madri', timezone: 'Europe/Madrid', tagline: 'Museus, praças e vida de bairro', overview: 'Capital animada, com museus de primeira e um jantar que começa tarde.', best_season: 'Abril a junho; setembro a outubro', photo: 'madri.jpg', art: { colors: ['#D9354F', '#4B134B'], icon: 'bank' } }),
  D('granada', 'Espanha', 'Granada', { parent: 'espanha', region: 'Andaluzia', timezone: 'Europe/Madrid', tagline: 'A Alhambra e o sul espanhol', overview: 'Palácios mouros, flamenco e montanhas nevadas no horizonte.', best_season: 'Março a maio; setembro a novembro', photo: 'granada.jpg', art: { colors: ['#D45F0A', '#14A06B'], icon: 'castle-turret' } }),
  D('islandia', 'Islândia', null, { timezone: 'Atlantic/Reykjavik' }),
  D('reykjavik', 'Islândia', 'Reykjavík', { parent: 'islandia', region: 'Höfuðborgarsvæðið', timezone: 'Atlantic/Reykjavik', tagline: 'Gelo, fogo e aurora boreal', overview: 'Base pra cachoeiras, geleiras, lagoas termais e, com sorte, a aurora boreal.', best_season: 'Junho a agosto (sol da meia-noite); setembro a março (aurora)', photo: 'islandia.jpg', art: { colors: ['#14A06B', '#2A0220'], icon: 'snowflake' } }),
  D('mexico', 'México', null, { timezone: 'America/Mexico_City' }),
  D('cidade-do-mexico', 'México', 'Cidade do México', { parent: 'mexico', timezone: 'America/Mexico_City', tagline: 'Cores, sabores e pirâmides', overview: 'Uma das maiores cidades do mundo, com comida de rua lendária e história asteca.', best_season: 'Março a maio; outubro a novembro', photo: 'mexico-tacos.jpg', art: { colors: ['#D9354F', '#14A06B'], icon: 'fire' } }),
  D('riviera-maya', 'México', 'Riviera Maya', { parent: 'mexico', region: 'Quintana Roo', timezone: 'America/Cancun', tagline: 'Mar caribenho e ruínas maias', overview: 'Cancún, Tulum, cenotes e aquele azul do Caribe que nem parece real.', best_season: 'Dezembro a abril', photo: 'riviera-maya.jpg', art: { colors: ['#2D6BE0', '#14A06B'], icon: 'beach-ball' } }),
  D('aruba', 'Aruba', null, { timezone: 'America/Aruba', tagline: 'One happy island', overview: 'Praias de areia branca, vento constante e sol quase o ano inteiro.', best_season: 'Ano todo (fora da rota de furacões)', photo: 'aruba.jpg', art: { colors: ['#2D6BE0', '#F77A10'], icon: 'beach-ball' } }),
  D('tanzania', 'Tanzânia', null, { timezone: 'Africa/Dar_es_Salaam' }),
  D('zanzibar', 'Tanzânia', 'Zanzibar', { parent: 'tanzania', region: 'Arquipélago de Zanzibar', timezone: 'Africa/Dar_es_Salaam', tagline: 'Águas turquesa no Índico', overview: 'Ilha de mar azul-piscina, areia branquinha e barcos de madeira tradicionais. As praias do norte são as mais procuradas.', best_season: 'Junho a outubro; dezembro a fevereiro', photo: 'zanzibar-praias.jpg', art: { colors: ['#2D6BE0', '#14A06B'], icon: 'waves' } }),
  D('portugal', 'Portugal', null, { timezone: 'Europe/Lisbon' }),
  D('lisboa', 'Portugal', 'Lisboa', { parent: 'portugal', timezone: 'Europe/Lisbon', tagline: 'Pastel de nata e vista do miradouro', overview: 'Ladeiras, bondinho amarelo e fado: Lisboa é charme puro.', best_season: 'Março a junho; setembro a outubro', photo: 'lisboa.jpg', art: { colors: ['#F77A10', '#2D6BE0'], icon: 'cable-car' } }),
  D('japao', 'Japão', null, { timezone: 'Asia/Tokyo' }),
  D('toquio', 'Japão', 'Tóquio', { parent: 'japao', timezone: 'Asia/Tokyo', tagline: 'Tradição e futuro lado a lado', overview: 'Templos, neon, comida incrível e uma organização que impressiona.', best_season: 'Março a maio (sakura); outubro a novembro', photo: 'toquio.jpg', art: { colors: ['#D9354F', '#6D1660'], icon: 'city' } }),
];

const P = (id, destination, name, category, description, address, lat, lng, extra = {}) => ({
  id, destination, name, category, description, address, lat, lng, ...extra,
});

export const PLACES = [
  // Rio de Janeiro
  P('rio-cristo-redentor', 'rio', 'Cristo Redentor', 'ponto_turistico', 'O braço aberto mais famoso do Brasil, lá no topo do Corcovado, com a cidade inteira aos pés.', 'Parque Nacional da Tijuca, Alto da Boa Vista, Rio de Janeiro - RJ', -22.9519, -43.2105, { tags: ['vista', 'ícone'], photo: 'rio-cristo.jpg' }),
  P('rio-pao-de-acucar', 'rio', 'Bondinho Pão de Açúcar', 'ponto_turistico', 'Dois bondinhos, dois morros e uma vista de 360° da Baía de Guanabara. No fim de tarde é covardia.', 'Av. Pasteur, 520, Urca, Rio de Janeiro - RJ', -22.9486, -43.1566, { url: 'https://www.bondinho.com.br', tags: ['vista', 'pôr do sol'] }),
  P('rio-escadaria-selaron', 'rio', 'Escadaria Selarón', 'ponto_turistico', 'Mais de 200 degraus cobertos de azulejos do mundo todo, entre a Lapa e Santa Teresa.', 'R. Joaquim Silva, Lapa, Rio de Janeiro - RJ', -22.9154, -43.1791, { tags: ['arte', 'foto'] }),
  P('rio-copacabana', 'rio', 'Praia de Copacabana', 'ponto_turistico', 'Calçadão de ondinhas, quiosque, futevôlei e aquele mar que é a cara do Rio.', 'Av. Atlântica, Copacabana, Rio de Janeiro - RJ', -22.9711, -43.1822, { tags: ['praia'] }),
  P('rio-jardim-botanico', 'rio', 'Jardim Botânico do Rio', 'experiencia', 'Palmeiras imperiais, orquidário e um respiro verde no meio da cidade.', 'R. Jardim Botânico, 1008, Jardim Botânico, Rio de Janeiro - RJ', -22.9668, -43.2245, { tags: ['natureza'] }),
  // Paris
  P('paris-torre-eiffel', 'paris', 'Torre Eiffel', 'ponto_turistico', 'O símbolo de Paris. Sobe pra ver a cidade do alto ou fica no Champ de Mars esperando ela brilhar.', 'Champ de Mars, 5 Av. Anatole France, 75007 Paris', 48.8584, 2.2945, { url: 'https://www.toureiffel.paris', tags: ['ícone', 'vista'], photo: 'paris-eiffel.jpg' }),
  P('paris-louvre', 'paris', 'Museu do Louvre', 'museu_cultura', 'O maior museu do mundo, com a Mona Lisa e a pirâmide de vidro mais fotografada da história.', 'Rue de Rivoli, 75001 Paris', 48.8606, 2.3376, { url: 'https://www.louvre.fr', tags: ['arte', 'história'] }),
  P('paris-orsay', 'paris', "Musée d'Orsay", 'museu_cultura', 'Impressionistas numa antiga estação de trem. Monet, Van Gogh e Renoir num só lugar.', "Esplanade Valéry Giscard d'Estaing, 75007 Paris", 48.86, 2.3266, { url: 'https://www.musee-orsay.fr', tags: ['arte'] }),
  P('paris-arco-do-triunfo', 'paris', 'Arco do Triunfo', 'ponto_turistico', 'No topo da Champs-Élysées, com terraço e vista das avenidas em formato de estrela.', 'Place Charles de Gaulle, 75008 Paris', 48.8738, 2.295, { url: 'https://www.paris-arc-de-triomphe.fr', tags: ['vista', 'história'] }),
  P('paris-montmartre', 'paris', 'Sacré-Cœur e Montmartre', 'ponto_turistico', 'Bairro dos artistas, ladeiras charmosas e a basílica branquinha lá no alto.', '35 Rue du Chevalier de la Barre, 75018 Paris', 48.8867, 2.3431, { tags: ['bairro', 'vista'] }),
  // Londres
  P('londres-big-ben', 'londres', 'Big Ben e Parlamento', 'ponto_turistico', 'A torre do relógio mais famosa do mundo, na beira do Tâmisa.', 'Westminster, London SW1A 0AA', 51.5007, -0.1246, { tags: ['ícone', 'história'], photo: 'londres-big-ben.jpg' }),
  P('londres-london-eye', 'londres', 'London Eye', 'experiencia', 'A roda-gigante às margens do Tâmisa, com cabines de vidro e vista da cidade inteira.', 'Riverside Building, County Hall, London SE1 7PB', 51.5033, -0.1196, { url: 'https://www.londoneye.com', tags: ['vista'] }),
  P('londres-british-museum', 'londres', 'British Museum', 'museu_cultura', 'Da Pedra de Roseta às múmias egípcias: um passeio pela história da humanidade.', 'Great Russell St, London WC1B 3DG', 51.5194, -0.127, { url: 'https://www.britishmuseum.org', tags: ['história'] }),
  P('londres-torre', 'londres', 'Torre de Londres', 'ponto_turistico', 'Fortaleza milenar onde ficam as Joias da Coroa. Os guardas contam cada história…', 'London EC3N 4AB', 51.5081, -0.0759, { url: 'https://www.hrp.org.uk/tower-of-london/', tags: ['história', 'realeza'] }),
  P('londres-camden', 'londres', 'Camden Market', 'compras', 'Brechós, comida do mundo todo e a vibe alternativa de Londres.', 'Camden Lock Pl, London NW1 8AF', 51.5413, -0.146, { tags: ['compras', 'comida de rua'] }),
  // Orlando
  P('orlando-magic-kingdom', 'orlando', 'Magic Kingdom', 'experiencia', 'O castelo da Cinderela, os fogos e os clássicos da Disney. O parque mais mágico de todos.', '1180 Seven Seas Dr, Lake Buena Vista, FL 32830', 28.4177, -81.5812, { url: 'https://disneyworld.disney.go.com', tags: ['parque', 'família'], photo: 'disney-castelo.jpg' }),
  P('orlando-epcot', 'orlando', 'EPCOT', 'experiencia', 'Uma volta ao mundo em um dia, com atrações de tecnologia e muita comidinha.', '200 Epcot Center Dr, Orlando, FL 32821', 28.3747, -81.5494, { url: 'https://disneyworld.disney.go.com', tags: ['parque', 'família'] }),
  P('orlando-universal', 'orlando', 'Universal Orlando Resort', 'experiencia', 'Harry Potter, montanhas-russas e os filmes da Universal ganhando vida.', '6000 Universal Blvd, Orlando, FL 32819', 28.4743, -81.4678, { url: 'https://www.universalorlando.com', tags: ['parque', 'adrenalina'] }),
  P('orlando-disney-springs', 'orlando', 'Disney Springs', 'compras', 'Lojas, restaurantes e shows à beira do lago. Ótimo pra fechar o dia.', '1486 E Buena Vista Dr, Lake Buena Vista, FL 32830', 28.371, -81.5194, { tags: ['compras', 'restaurantes'] }),
  // Nova York
  P('ny-estatua-da-liberdade', 'nova-york', 'Estátua da Liberdade', 'ponto_turistico', 'O símbolo de Nova York, numa ilha logo na entrada do porto.', 'Liberty Island, New York, NY 10004', 40.6892, -74.0445, { url: 'https://www.nps.gov/stli', tags: ['ícone'] }),
  P('ny-central-park', 'nova-york', 'Central Park', 'experiencia', 'O quintal de Nova York: lagos, gramados e um piquenique que vale o dia.', 'New York, NY', 40.7829, -73.9654, { url: 'https://www.centralparknyc.org', tags: ['natureza', 'grátis'] }),
  P('ny-moma', 'nova-york', 'MoMA', 'museu_cultura', 'Arte moderna de primeira: Van Gogh, Warhol, Frida e muito mais.', '11 W 53rd St, New York, NY 10019', 40.7614, -73.9776, { url: 'https://www.moma.org', tags: ['arte'] }),
  P('ny-times-square', 'nova-york', 'Times Square', 'ponto_turistico', 'Luzes, telões e Broadway logo ali. À noite fica ainda mais surreal.', 'Manhattan, NY 10036', 40.758, -73.9855, { tags: ['ícone', 'noite'] }),
  // Machu Picchu / Cusco
  P('peru-machu-picchu', 'machu-picchu', 'Santuário Histórico de Machu Picchu', 'ponto_turistico', 'A cidadela inca entre montanhas e nuvens. Ingresso com horário marcado: planeje antes!', 'Machu Picchu, Cusco, Peru', -13.1631, -72.545, { url: 'https://www.machupicchu.gob.pe', tags: ['história', 'trilha'], photo: 'machu-picchu-cidadela.jpg' }),
  P('peru-cusco-plaza', 'machu-picchu', 'Plaza de Armas de Cusco', 'ponto_turistico', 'O coração da antiga capital inca, com catedral, varandas e muito movimento.', 'Plaza de Armas, Cusco, Peru', -13.5167, -71.9788, { tags: ['história'] }),
  P('peru-ollantaytambo', 'machu-picchu', 'Ollantaytambo', 'ponto_turistico', 'Vila inca no Vale Sagrado, com terraços impressionantes e estação de trem pra Machu Picchu.', 'Ollantaytambo, Vale Sagrado, Cusco, Peru', -13.258, -72.263, { tags: ['história', 'trilha'] }),
  // Ilha de Páscoa
  P('pascoa-ahu-tongariki', 'ilha-de-pascoa', 'Ahu Tongariki', 'ponto_turistico', 'Quinze moais enfileirados de frente pra ilha. O nascer do sol aqui é inesquecível.', 'Ahu Tongariki, Rapa Nui, Chile', -27.1258, -109.2769, { tags: ['ícone', 'nascer do sol'], photo: 'pascoa-moais.jpg' }),
  P('pascoa-rano-raraku', 'ilha-de-pascoa', 'Rano Raraku', 'ponto_turistico', 'A "fábrica" dos moais: a cratera de onde saíram as estátuas, várias ainda pela metade.', 'Rano Raraku, Rapa Nui, Chile', -27.1225, -109.2886, { tags: ['história'] }),
  P('pascoa-anakena', 'ilha-de-pascoa', 'Praia de Anakena', 'ponto_turistico', 'Areia branca, coqueiros e moais de guarda. A praia mais bonita da ilha.', 'Anakena, Rapa Nui, Chile', -27.0733, -109.3236, { tags: ['praia'] }),
  // Pequim
  P('pequim-mutianyu', 'pequim', 'Muralha da China em Mutianyu', 'ponto_turistico', 'Trecho restaurado e menos lotado da Muralha, com teleférico e tobogã pra descer.', 'Mutianyu, Huairou, Pequim, China', 40.4319, 116.5704, { tags: ['ícone', 'trilha'], photo: 'muralha.jpg' }),
  P('pequim-badaling', 'pequim', 'Muralha da China em Badaling', 'ponto_turistico', 'O trecho mais famoso e fácil de chegar a partir de Pequim.', 'Badaling, Yanqing, Pequim, China', 40.354, 116.02, { tags: ['ícone'] }),
  P('pequim-beihai', 'pequim', 'Parque Beihai', 'ponto_turistico', 'Parque imperial com lago, pavilhões vermelhos e dourados e pontes de pedra. Ótimo no fim de tarde.', '1 Wenjin St, Xicheng, Pequim, China', 39.9255, 116.3833, { tags: ['parque', 'história'], photo: 'pequim-beihai.jpg' }),
  P('pequim-cidade-proibida', 'pequim', 'Cidade Proibida', 'museu_cultura', 'O palácio dos imperadores, com centenas de construções e pátios gigantes.', '4 Jingshan Front St, Dongcheng, Pequim, China', 39.9163, 116.3972, { tags: ['história'] }),
  P('pequim-templo-do-ceu', 'pequim', 'Templo do Céu', 'ponto_turistico', 'Templo circular no meio de um parque onde os locais dançam, cantam e jogam de manhã.', 'Tiantan Park, Dongcheng, Pequim, China', 39.8822, 116.4066, { tags: ['história', 'parque'] }),
  // Roma
  P('roma-coliseu', 'roma', 'Coliseu', 'ponto_turistico', 'O anfiteatro mais famoso do mundo. Dá até pra ouvir a torcida dos gladiadores.', 'Piazza del Colosseo, 1, 00184 Roma', 41.8902, 12.4922, { url: 'https://parcocolosseo.it', tags: ['história', 'ícone'], photo: 'roma-coliseu.jpg' }),
  P('roma-fontana-di-trevi', 'roma', 'Fontana di Trevi', 'ponto_turistico', 'Joga a moedinha de costas pra garantir a volta a Roma. Cedinho é mais tranquilo.', 'Piazza di Trevi, 00187 Roma', 41.9009, 12.4833, { tags: ['ícone'], photo: 'roma-trevi.jpg' }),
  P('roma-museus-vaticanos', 'roma', 'Museus Vaticanos e Capela Sistina', 'museu_cultura', 'O teto de Michelangelo e séculos de arte. Reserve com antecedência.', 'Viale Vaticano, 00165 Roma', 41.9065, 12.4536, { url: 'https://www.museivaticani.va', tags: ['arte', 'história'] }),
  P('roma-pantheon', 'roma', 'Panteão', 'ponto_turistico', 'Templo romano com a cúpula aberta pro céu. Quando chove, a água cai lá dentro.', 'Piazza della Rotonda, 00186 Roma', 41.8986, 12.4769, { tags: ['história'] }),
  // Florença
  P('florenca-uffizi', 'florenca', 'Galeria Uffizi', 'museu_cultura', 'Botticelli, Leonardo e Michelangelo. O Renascimento todo numa galeria.', 'Piazzale degli Uffizi, 6, 50122 Firenze', 43.7678, 11.2553, { url: 'https://www.uffizi.it', tags: ['arte'] }),
  P('florenca-duomo', 'florenca', 'Duomo de Florença', 'ponto_turistico', 'A cúpula de Brunelleschi domina a cidade. Subir os degraus vale cada um.', 'Piazza del Duomo, 50122 Firenze', 43.7731, 11.256, { tags: ['ícone', 'vista'], photo: 'florenca-duomo.jpg' }),
  P('florenca-ponte-vecchio', 'florenca', 'Ponte Vecchio', 'ponto_turistico', 'Ponte medieval cheia de joalherias sobre o Arno. No pôr do sol fica dourada.', 'Ponte Vecchio, 50125 Firenze', 43.768, 11.2531, { tags: ['pôr do sol'] }),
  // Veneza
  P('veneza-san-marco', 'veneza', 'Praça São Marcos', 'ponto_turistico', 'A sala de estar de Veneza, com a basílica dourada e o campanário.', 'Piazza San Marco, 30124 Venezia', 45.4341, 12.3388, { tags: ['ícone'], photo: 'veneza-canal.jpg' }),
  P('veneza-rialto', 'veneza', 'Ponte de Rialto', 'ponto_turistico', 'A ponte mais antiga sobre o Grande Canal, com mercado ali do lado.', 'Ponte di Rialto, 30125 Venezia', 45.438, 12.3359, { tags: ['ícone'] }),
  // Atenas e Santorini
  P('atenas-acropole', 'atenas', 'Acrópole e Partenon', 'ponto_turistico', 'O templo mais famoso da Grécia antiga, lá no alto da cidade.', 'Atenas 105 58, Grécia', 37.9715, 23.7257, { tags: ['história', 'ícone'], photo: 'atenas-partenon.jpg' }),
  P('atenas-museu-acropole', 'atenas', 'Museu da Acrópole', 'museu_cultura', 'Museu moderno com piso de vidro sobre ruínas e as esculturas originais do Partenon.', 'Dionysiou Areopagitou 15, Atenas 117 42', 37.9685, 23.7285, { url: 'https://www.theacropolismuseum.gr', tags: ['história'] }),
  P('santorini-oia', 'santorini', 'Oia', 'ponto_turistico', 'A vila das cúpulas azuis e do pôr do sol mais disputado do planeta. Chegue cedo!', 'Oia, Santorini 847 02, Grécia', 36.4618, 25.3753, { tags: ['pôr do sol', 'foto'], photo: 'santorini-oia.jpg' }),
  // Espanha
  P('barcelona-sagrada-familia', 'barcelona', 'Sagrada Família', 'ponto_turistico', 'A obra-prima de Gaudí, em construção há mais de um século. Por dentro parece uma floresta de luz.', 'C/ de Mallorca, 401, 08013 Barcelona', 41.4036, 2.1744, { url: 'https://sagradafamilia.org', tags: ['arquitetura', 'ícone'], photo: 'barcelona-sagrada.jpg' }),
  P('barcelona-park-guell', 'barcelona', 'Park Güell', 'ponto_turistico', 'Mosaicos coloridos, a salamandra famosa e vista da cidade até o mar.', '08024 Barcelona', 41.4145, 2.1527, { url: 'https://parkguell.barcelona', tags: ['arquitetura', 'vista'] }),
  P('madri-prado', 'madri', 'Museo del Prado', 'museu_cultura', 'Velázquez, Goya e El Greco num dos maiores museus de arte do mundo.', 'C. de Ruiz de Alarcón, 23, 28014 Madrid', 40.4138, -3.6921, { url: 'https://www.museodelprado.es', tags: ['arte'] }),
  P('granada-alhambra', 'granada', 'Alhambra', 'ponto_turistico', 'Palácio e fortaleza moura com jardins e detalhes de tirar o fôlego. Ingresso esgota rápido.', 'C. Real de la Alhambra, 18009 Granada', 37.1761, -3.5881, { url: 'https://www.alhambra-patronato.es', tags: ['história', 'arquitetura'] }),
  // Islândia
  P('islandia-blue-lagoon', 'reykjavik', 'Blue Lagoon', 'experiencia', 'Lagoa geotermal de água azul-leitosa no meio da lava. Relax nível máximo.', 'Norðurljósavegur 9, 240 Grindavík, Islândia', 63.8804, -22.4495, { url: 'https://www.bluelagoon.com', tags: ['relax'], photo: 'islandia-lagoon.jpg' }),
  P('islandia-hallgrimskirkja', 'reykjavik', 'Hallgrímskirkja', 'ponto_turistico', 'A igreja que parece uma montanha de basalto, com mirante sobre Reykjavík.', 'Hallgrímstorg 1, 101 Reykjavík', 64.1417, -21.9266, { url: 'https://www.hallgrimskirkja.is', tags: ['vista', 'arquitetura'] }),
  P('islandia-gullfoss', 'reykjavik', 'Gullfoss', 'ponto_turistico', 'Cachoeira em dois degraus, parada clássica do Círculo Dourado.', 'Gullfoss, Islândia', 64.3271, -20.1199, { tags: ['natureza'] }),
  P('islandia-jokulsarlon', 'reykjavik', 'Jökulsárlón', 'ponto_turistico', 'Lagoa glacial com icebergs flutuando e focas de vez em quando.', 'Jökulsárlón, Islândia', 64.0784, -16.2306, { tags: ['natureza', 'gelo'] }),
  // México
  P('mexico-teotihuacan', 'cidade-do-mexico', 'Teotihuacan', 'ponto_turistico', 'As pirâmides do Sol e da Lua, a cerca de uma hora da capital.', 'San Juan Teotihuacán, Estado do México', 19.6925, -98.8438, { tags: ['história'], photo: 'mexico-teotihuacan.jpg' }),
  P('mexico-antropologia', 'cidade-do-mexico', 'Museo Nacional de Antropología', 'museu_cultura', 'O melhor jeito de entender as culturas asteca e maia antes de ver as ruínas.', 'Av. Paseo de la Reforma s/n, Chapultepec, Cidade do México', 19.426, -99.1863, { url: 'https://www.mna.inah.gob.mx', tags: ['história'] }),
  P('mexico-chichen-itza', 'riviera-maya', 'Chichén Itzá', 'ponto_turistico', 'A pirâmide de Kukulcán, uma das maravilhas do mundo moderno.', 'Chichén Itzá, Yucatán, México', 20.6843, -88.5678, { tags: ['história', 'ícone'] }),
  P('mexico-tulum', 'riviera-maya', 'Ruínas de Tulum', 'ponto_turistico', 'Ruínas maias em cima de um penhasco, com o mar caribenho embaixo.', 'Tulum, Quintana Roo, México', 20.2149, -87.4291, { tags: ['história', 'praia'] }),
  // Aruba
  P('aruba-eagle-beach', 'aruba', 'Eagle Beach', 'ponto_turistico', 'Areia branquinha, mar calmo e as árvores fofoti que viraram símbolo da ilha.', 'Eagle Beach, Aruba', 12.55, -70.057, { tags: ['praia'], photo: 'aruba-eagle.jpg' }),
  P('aruba-palm-beach', 'aruba', 'Palm Beach', 'ponto_turistico', 'A praia dos resorts, cheia de bares e esportes aquáticos.', 'Palm Beach, Noord, Aruba', 12.58, -70.045, { tags: ['praia', 'noite'] }),
  P('aruba-arikok', 'aruba', 'Parque Nacional Arikok', 'experiencia', 'Deserto, cavernas e piscinas naturais. Melhor ir de 4x4 ou com passeio guiado.', 'Parque Nacional Arikok, Aruba', 12.495, -69.945, { url: 'https://www.arubanationalpark.org', tags: ['natureza', 'aventura'] }),
  // Zanzibar
  P('zanzibar-praias-norte', 'zanzibar', 'Praias do norte (Nungwi e Kendwa)', 'ponto_turistico', 'Areia clara, mar transparente e pôr do sol de cartão-postal. Dá pra passear de barco tradicional (dhow).', 'Nungwi, Zanzibar, Tanzânia', -5.7256, 39.2979, { tags: ['praia', 'pôr do sol'], photo: 'zanzibar-praias.jpg' }),
  // Lisboa
  P('lisboa-torre-de-belem', 'lisboa', 'Torre de Belém', 'ponto_turistico', 'Fortaleza à beira do Tejo, cartão-postal das Grandes Navegações.', 'Av. Brasília, 1400-038 Lisboa', 38.6916, -9.216, { tags: ['história', 'ícone'], photo: 'lisboa-belem.jpg' }),
  P('lisboa-jeronimos', 'lisboa', 'Mosteiro dos Jerónimos', 'museu_cultura', 'Arquitetura manuelina de impressionar. E os pastéis de Belém ficam do lado…', 'Praça do Império, 1400-206 Lisboa', 38.6979, -9.2068, { tags: ['história'] }),
  P('lisboa-alfama', 'lisboa', 'Alfama', 'experiencia', 'O bairro mais antigo de Lisboa: vielas, miradouros e fado à noite.', 'Alfama, Lisboa', 38.7114, -9.13, { tags: ['bairro', 'música'] }),
  // Tóquio
  P('toquio-senso-ji', 'toquio', 'Templo Senso-ji', 'ponto_turistico', 'O templo mais antigo de Tóquio, com o portão do lanternão vermelho.', '2-3-1 Asakusa, Taito, Tóquio', 35.7148, 139.7967, { tags: ['história'], photo: 'toquio-sensoji.jpg' }),
  P('toquio-shibuya', 'toquio', 'Cruzamento de Shibuya', 'ponto_turistico', 'O cruzamento mais movimentado do mundo. Atravessa uma vez e já entende Tóquio.', 'Shibuya, Tóquio', 35.6595, 139.7005, { tags: ['ícone', 'noite'] }),
  P('toquio-skytree', 'toquio', 'Tokyo Skytree', 'ponto_turistico', 'A torre mais alta do Japão, com mirantes de vidro sobre a cidade.', '1-1-2 Oshiage, Sumida, Tóquio', 35.7101, 139.8107, { url: 'https://www.tokyo-skytree.jp', tags: ['vista'] }),
];

/** Nome de exibição de um destino. */
export const destinationName = (d) => (d ? d.city || d.region || d.country : '');

/** Linhas no formato exato das abas DESTINATIONS e PLACES (importação de conteúdo). */
export function libraryAsSheets(today) {
  const DEST = [['destination_id', 'country', 'region', 'city', 'language', 'overview', 'best_season', 'timezone', 'parent_id']];
  for (const d of DESTINATIONS) DEST.push([d.id, d.country, d.region || '', d.city || '', '', d.overview || '', d.best_season || '', d.timezone || '', d.parent || '']);
  const PL = [['content_id', 'destination_id', 'name', 'category', 'short_description', 'address', 'latitude', 'longitude', 'official_url', 'tags', 'source_url', 'last_verified_at', 'status', 'verification_notes']];
  for (const p of PLACES)
    PL.push([
      p.id, p.destination, p.name, p.category, p.description, p.address, p.lat, p.lng, p.url || '', (p.tags || []).join(', '), '', today, 'pendente',
      'Montado sem acesso à internet: conferir endereço, coordenadas e site oficial. Horário e preço não verificados.',
    ]);
  return { DESTINATIONS: DEST, PLACES: PL };
}
