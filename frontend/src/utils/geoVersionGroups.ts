export interface GeoNamedGroupItem<T> {
  item: T
  key: string
  category: string
  platform: string
  displayName: string
}

export interface GeoNamedGroup<T> {
  key: string
  category: string
  platform: string
  label: string
  items: GeoNamedGroupItem<T>[]
}

export interface GeoNamedCategoryGroup<T> {
  key: string
  category: string
  count: number
  groups: GeoNamedGroup<T>[]
}

export interface GeoVersionCascaderOption {
  value: string | number
  label: string
  children?: GeoVersionCascaderOption[]
}

const NAME_SPLIT_PATTERN = /\s*[-－—–]\s*/

export const parseGeoVersionName = (name: string) => {
  const normalizedName = name.trim()
  const parts = normalizedName.split(NAME_SPLIT_PATTERN).map((part) => part.trim()).filter(Boolean)

  if (parts.length >= 3) {
    return {
      category: parts[0],
      platform: parts[1],
      displayName: parts.slice(2).join('-'),
      isFallback: false,
    }
  }

  if (parts.length === 2) {
    return {
      category: parts[0],
      platform: '未分渠道',
      displayName: parts[1],
      isFallback: true,
    }
  }

  return {
    category: '未分类',
    platform: '其他版本',
    displayName: normalizedName || '未命名版本',
    isFallback: true,
  }
}

export const getGeoVersionGroupLabel = (name: string) => {
  const { category, platform } = parseGeoVersionName(name)
  return `${category} / ${platform}`
}

export const getGeoVersionDisplayName = (name: string) => {
  return parseGeoVersionName(name).displayName
}

export const groupGeoNamedItems = <T>(
  items: T[],
  getName: (item: T) => string,
  getKey: (item: T) => string | number
) => {
  const groups: GeoNamedGroup<T>[] = []
  const groupMap = new Map<string, GeoNamedGroup<T>>()

  items.forEach((item) => {
    const name = getName(item)
    const parsed = parseGeoVersionName(name)
    const groupKey = `${parsed.category}\u0000${parsed.platform}`
    let group = groupMap.get(groupKey)

    if (!group) {
      group = {
        key: groupKey,
        category: parsed.category,
        platform: parsed.platform,
        label: `${parsed.category} / ${parsed.platform}`,
        items: [],
      }
      groupMap.set(groupKey, group)
      groups.push(group)
    }

    group.items.push({
      item,
      key: String(getKey(item)),
      category: parsed.category,
      platform: parsed.platform,
      displayName: parsed.displayName,
    })
  })

  return groups
}

export const groupGeoNamedItemsByCategory = <T>(
  items: T[],
  getName: (item: T) => string,
  getKey: (item: T) => string | number
) => {
  const flatGroups = groupGeoNamedItems(items, getName, getKey)
  const categoryGroups: GeoNamedCategoryGroup<T>[] = []
  const categoryMap = new Map<string, GeoNamedCategoryGroup<T>>()

  flatGroups.forEach((group) => {
    let categoryGroup = categoryMap.get(group.category)

    if (!categoryGroup) {
      categoryGroup = {
        key: group.category,
        category: group.category,
        count: 0,
        groups: [],
      }
      categoryMap.set(group.category, categoryGroup)
      categoryGroups.push(categoryGroup)
    }

    categoryGroup.groups.push(group)
    categoryGroup.count += group.items.length
  })

  return categoryGroups
}

export const buildGeoVersionCascaderOptions = <T>(
  items: T[],
  getName: (item: T) => string,
  getKey: (item: T) => string | number
) => {
  return groupGeoNamedItemsByCategory(items, getName, getKey).map<GeoVersionCascaderOption>((category) => ({
    value: `category:${category.category}`,
    label: category.category,
    children: category.groups.map((group) => ({
      value: `platform:${group.category}:${group.platform}`,
      label: group.platform,
      children: group.items.map(({ item, displayName }) => ({
        value: getKey(item),
        label: displayName,
      })),
    })),
  }))
}
