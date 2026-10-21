async function main() {
  const query = `[out:json][timeout:35];
(
  relation["route"="hiking"]["name"~"Ghorepani|Poon|Poon Hill|Sanctuary|Annapurna"](28.25,83.60,28.68,84.02);
  node["place"~"village|town|hamlet"]["name"~"Nayapul|Naya Pul|Birethanti|Hile|Tikhedhunga|Tikhedhungga|Ulleri|Banthanti|Ghorepani|Deurali|Tadapani|Chuile|Chhomrong|Chhomorong|Sinuwa|Bamboo|Dovan|Himalaya|Deurali|Machapuchare|MBC|Annapurna Base Camp|ABC"](28.25,83.60,28.68,84.02);
);
out tags center;
`;
  console.log('Querying Overpass for relations and village nodes...');
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'AnnapurnaTrail/1.0 (contact: github.com/isha-undhad/annapurna-trail)'
    },
    body: 'data=' + encodeURIComponent(query)
  });
  const data = await res.json();
  console.log('Results:');
  for (const el of data.elements) {
    if (el.type === 'relation') {
      console.log(`Relation ID: ${el.id}, Name: ${el.tags?.name}, From: ${el.tags?.from}, To: ${el.tags?.to}`);
    } else if (el.type === 'node') {
      console.log(`Node ID: ${el.id}, Name: ${el.tags?.name}, Lat: ${el.lat}, Lon: ${el.lon}, Place: ${el.tags?.place}`);
    }
  }
}

main().catch(console.error);
