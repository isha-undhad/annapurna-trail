const query = `[out:json][timeout:35];
(
  node["name"~"Nayapul|Naya Pul|Birethanti|Ulleri|Ghorepani|Tadapani|Chhomrong|Chhomorong|Sinuwa|Bamboo|Dovan|Himalaya|Deurali|Machapuchare Base Camp|MBC|Annapurna Base Camp|ABC"](28.25,83.60,28.68,84.02);
  relation["route"="hiking"](28.25,83.60,28.68,84.02);
);
out body;
`;

async function queryOverpass(endpoint) {
  return fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'AnnapurnaTrailTrekkingSimulator/1.0 (contact: github.com/isha-undhad/annapurna-trail)'
    },
    body: 'data=' + encodeURIComponent(query)
  });
}

async function main() {
  console.log('Querying Overpass API...');
  const endpoints = [
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
  ];
  let res = null;
  for (const ep of endpoints) {
    try {
      console.log('Trying', ep);
      res = await queryOverpass(ep);
      if (res.ok) break;
      console.log('Got status', res.status);
    } catch (e) {
      console.log('Failed', ep, e.message);
    }
  }
  if (!res.ok) {
    console.error('Overpass HTTP error:', res.status, res.statusText);
    const txt = await res.text();
    console.error(txt.slice(0, 500));
    return;
  }
  const data = await res.json();
  const nodes = data.elements.filter(e => e.type === 'node');
  const relations = data.elements.filter(e => e.type === 'relation');
  console.log(`Found ${nodes.length} nodes and ${relations.length} relations.`);
  console.log('Nodes:');
  for (const n of nodes) {
    console.log(`- ${n.tags?.name || 'Unnamed'}: lat=${n.lat}, lon=${n.lon}, place=${n.tags?.place}, tourism=${n.tags?.tourism}`);
  }
  console.log('\nRelations:');
  for (const r of relations) {
    console.log(`- ID: ${r.id}, Name: ${r.tags?.name}, From: ${r.tags?.from}, To: ${r.tags?.to}`);
  }
}

main().catch(err => console.error(err));
