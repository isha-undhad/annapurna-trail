async function fetchRelation() {
  const query = `[out:json][timeout:60];
relation(17548991);
out body;
>;
out skel qt;
`;
  console.log('Fetching Relation 17548991 (Annapurna Base Camp Trek)...');
  const res = await fetch('https://overpass.kumi.systems/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'AnnapurnaTrailTrekkingSimulator/1.0'
    },
    body: 'data=' + encodeURIComponent(query)
  });
  if (!res.ok) {
    console.error('Failed:', res.status, res.statusText);
    return;
  }
  const data = await res.json();
  const rel = data.elements.find(e => e.type === 'relation');
  const ways = data.elements.filter(e => e.type === 'way');
  const nodes = data.elements.filter(e => e.type === 'node');
  console.log(`Relation tags:`, rel?.tags);
  console.log(`Members count in relation:`, rel?.members?.length);
  console.log(`Ways returned: ${ways.length}, Nodes returned: ${nodes.length}`);
}

fetchRelation().catch(console.error);
