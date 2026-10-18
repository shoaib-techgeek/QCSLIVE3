import Icon from './Icon'

/**
 * Table header cell that toggles sorting.
 * @param {{ label: string, sortKey: string, sort: {key: string, dir: 'asc'|'desc'}, onSort: (key: string) => void }} props
 */
export default function SortableTh({ label, sortKey, sort, onSort }) {
  const active = sort.key === sortKey
  const ariaSort = active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'
  const icon = !active ? 'sort' : sort.dir === 'asc' ? 'chevronUp' : 'chevronDown'

  return (
    <th scope="col" aria-sort={ariaSort}>
      <button type="button" className={`th-sort${active ? ' is-active' : ''}`} onClick={() => onSort(sortKey)}>
        {label}
        <Icon name={icon} size={14} />
      </button>
    </th>
  )
}
