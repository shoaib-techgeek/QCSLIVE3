import { Link } from 'react-router-dom'
import { formatMoney } from '../lib/money.js'
import Icon from './Icon.jsx'

/** Prices arrive as integer minor units. `to` makes the whole card one link target. */
export default function ProductCard({ title, to, priceMinor, wasMinor, currency = 'PKR', imageUrl, rating, flag }) {
  const off = wasMinor > priceMinor ? Math.round((1 - priceMinor / wasMinor) * 100) : 0
  return (
    <article className="product-card">
      <div className="product-media">
        {imageUrl ? <img src={imageUrl} alt="" loading="lazy" /> : <span className="tile tile-violet" style={{ width: '40%', height: '40%' }} aria-hidden="true" />}
      </div>
      {(flag || off > 0) && <span className="product-flag">{flag ?? `${off}% off`}</span>}
      <div className="product-body">
        <h3 className="product-title"><Link to={to}>{title}</Link></h3>
        <div className="product-price">
          <span className="price">{formatMoney(priceMinor, currency)}</span>
          {off > 0 && <span className="price-was"><span className="visually-hidden">Was </span>{formatMoney(wasMinor, currency)}</span>}
        </div>
        {rating !== undefined && (
          <span className="rating"><Icon name="star" size={14} /> {rating.toFixed(1)}<span className="visually-hidden"> out of 5</span></span>
        )}
      </div>
    </article>
  )
}
