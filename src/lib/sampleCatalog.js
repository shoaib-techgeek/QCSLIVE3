// Presentation-only sample data. The live catalogue (P1.8) replaces this; nothing here is a real product, price or offer.
export const CATEGORIES = [
  { slug: 'women', name: 'Women', tone: 'coral' },
  { slug: 'men', name: 'Men', tone: 'violet' },
  { slug: 'home-kitchen', name: 'Home and kitchen', tone: 'mango' },
  { slug: 'electronics', name: 'Electronics', tone: 'ink' },
  { slug: 'phones', name: 'Phones and accessories', tone: 'teal' },
  { slug: 'beauty-health', name: 'Beauty and health', tone: 'coral' },
  { slug: 'kids-toys', name: 'Kids and toys', tone: 'mango' },
  { slug: 'bags-shoes', name: 'Bags and shoes', tone: 'violet' },
  { slug: 'sports', name: 'Sports and outdoors', tone: 'teal' },
  { slug: 'automotive', name: 'Automotive', tone: 'ink' },
]

// priceMinor / wasMinor are integer paisa (PKR).
const p = (slug, title, priceMinor, rating, wasMinor) => ({ slug, title, priceMinor, rating, wasMinor })

export const SHELVES = [
  {
    id: 'best-sellers',
    title: 'Best sellers',
    sort: 'best',
    products: [
      p('s1', 'Stainless steel water bottle, 750 ml', 129900, 4.8, 179900),
      p('s2', 'Cotton bedsheet set, double', 249900, 4.6),
      p('s3', 'Wireless earbuds with charging case', 349900, 4.5, 499900),
      p('s4', 'Non-stick frying pan, 26 cm', 179900, 4.7),
      p('s5', 'Phone stand, adjustable aluminium', 49900, 4.4),
      p('s6', 'Men’s running shoes, lightweight', 399900, 4.6, 549900),
    ],
  },
  {
    id: 'new-in',
    title: 'New in',
    sort: 'new',
    products: [
      p('n1', 'Women’s lawn suit, 3-piece', 289900, 4.3),
      p('n2', 'Kids’ building blocks, 120 pieces', 119900, 4.5),
      p('n3', 'LED desk lamp, rechargeable', 159900, 4.4),
      p('n4', 'Leather wallet, slim', 99900, 4.2, 139900),
      p('n5', 'Yoga mat, non-slip, 6 mm', 139900, 4.6),
      p('n6', 'Car seat organiser, 2 pockets', 69900, 4.1),
    ],
  },
  {
    id: 'top-rated',
    title: 'Top rated',
    sort: 'rated',
    products: [
      p('t1', 'Electric kettle, 1.7 litre', 219900, 4.9),
      p('t2', 'Backpack, 25 litre, water resistant', 269900, 4.8),
      p('t3', 'Face serum, vitamin C, 30 ml', 119900, 4.8, 159900),
      p('t4', 'Bluetooth speaker, portable', 299900, 4.7),
      p('t5', 'Kitchen knife set, 5 pieces', 189900, 4.7),
      p('t6', 'Power bank, 10,000 mAh', 189900, 4.7, 249900),
    ],
  },
]
