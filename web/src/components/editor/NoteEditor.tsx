'use client'

import * as React from 'react'
import { format, parse, isValid } from 'date-fns'
import { CalendarIcon, ChevronLeft, ChevronUp, Plus, X } from 'lucide-react'
import { apiFetch } from '@/lib/api'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import {
  AddPropertyButton,
  PropertyRow,
  TagsRow,
  defaultValue,
  migrateProperties,
} from './PropertyEditors'
import { cn, sanitizeTitle } from '@/lib/utils'
import { useUserStore } from '@/stores'
import type { PropertyMap, PropertyType, TypedProperty } from '@/lib/types'

const AUTOSAVE_DELAY = 1500
const FRONTMATTER_RE = /^\s*---[ \t]*\n([\s\S]*?\n)---[ \t]*\n/

interface NoteEditorProps {
  documentId: string
  initialContent?: string
  initialTitle?: string
  initialTags?: string[]
  initialDate?: string | null
  initialProperties?: Record<string, unknown>
  onTitleChange?: (title: string) => void
  backLabel?: string
  onBack?: () => void
  embedded?: boolean
}

function stripFrontmatter(content: string): { body: string; frontmatter: string; meta: Record<string, string> } {
  const match = content.match(FRONTMATTER_RE)
  if (!match) return { body: content, frontmatter: '', meta: {} }

  const meta: Record<string, string> = {}
  for (const line of match[1].split('\n')) {
    const idx = line.indexOf(':')
    if (idx > 0) {
      const key = line.slice(0, idx).trim()
      const value = line.slice(idx + 1).trim()
      if (key && value && !key.startsWith(' ') && !key.startsWith('-')) {
        meta[key] = value
      }
    }
  }

  return {
    body: content.slice(match[0].length),
    frontmatter: match[0],
    meta,
  }
}

async function getAccessToken() {
  return useUserStore.getState().accessToken
}

export function NoteEditor({
  documentId,
  initialContent,
  initialTitle,
  initialTags,
  initialDate,
  initialProperties,
  onTitleChange,
  backLabel,
  onBack,
  embedded,
}: NoteEditorProps) {
  const [title, setTitle] = React.useState(initialTitle ?? '')
  const [content, setContent] = React.useState(initialContent ?? '')
  const [date, setDate] = React.useState(initialDate ?? '')
  const [tags, setTags] = React.useState<string[]>(initialTags ?? [])
  const [tagInput, setTagInput] = React.useState('')
  const [properties, setProperties] = React.useState<PropertyMap>(() =>
    initialProperties ? migrateProperties(initialProperties) : {},
  )
  const [metaExpanded, setMetaExpanded] = React.useState(false)
  const [calendarOpen, setCalendarOpen] = React.useState(false)
  const [loaded, setLoaded] = React.useState(initialContent !== undefined)
  const [saveStatus, setSaveStatus] = React.useState<'idle' | 'saving' | 'saved'>('idle')

  const frontmatterRef = React.useRef('')
  const saveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const dirtyRef = React.useRef(false)
  const metaDirtyRef = React.useRef(false)
  const latestTitleRef = React.useRef(initialTitle ?? '')
  const latestContentRef = React.useRef(initialContent ?? '')
  const latestDateRef = React.useRef(initialDate ?? '')
  const latestTagsRef = React.useRef<string[]>(initialTags ?? [])
  const latestPropertiesRef = React.useRef<PropertyMap>(initialProperties ? migrateProperties(initialProperties) : {})

  const wordCount = React.useMemo(() => {
    const trimmed = content.trim()
    return trimmed ? trimmed.split(/\s+/).length : 0
  }, [content])

  const dateValue = React.useMemo(() => {
    if (!date) return undefined
    const parsed = parse(date, 'yyyy-MM-dd', new Date())
    return isValid(parsed) ? parsed : undefined
  }, [date])

  const save = React.useCallback(async () => {
    if (!dirtyRef.current) return

    dirtyRef.current = false
    const shouldPatchMeta = metaDirtyRef.current
    metaDirtyRef.current = false
    setSaveStatus('saving')

    const token = await getAccessToken()
    if (!token) {
      dirtyRef.current = true
      setSaveStatus('idle')
      return
    }

    try {
      const requests: Promise<unknown>[] = [
        apiFetch(`/api/v1/documents/${documentId}/content`, token, {
          method: 'PUT',
          body: JSON.stringify({
            content: `${frontmatterRef.current}${latestContentRef.current}`,
          }),
        }),
      ]

      if (shouldPatchMeta) {
        const hasProperties = Object.keys(latestPropertiesRef.current).length > 0
        requests.push(
          apiFetch(`/api/v1/documents/${documentId}`, token, {
            method: 'PATCH',
            body: JSON.stringify({
              title: latestTitleRef.current || null,
              tags: latestTagsRef.current.length > 0 ? latestTagsRef.current : null,
              date: latestDateRef.current || null,
              metadata: hasProperties ? { properties: latestPropertiesRef.current } : null,
            }),
          }),
        )
      }

      await Promise.all(requests)
      setSaveStatus('saved')
    } catch (error) {
      console.error('[NoteEditor] save failed:', error)
      dirtyRef.current = true
      setSaveStatus('idle')
    }
  }, [documentId])

  const scheduleSave = React.useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    saveTimerRef.current = setTimeout(() => {
      void save()
    }, AUTOSAVE_DELAY)
  }, [save])

  React.useEffect(() => {
    let cancelled = false

    const load = async () => {
      const token = await getAccessToken()
      if (!token || cancelled) return

      try {
        const response = await apiFetch<{ id: string; content: string }>(
          `/api/v1/documents/${documentId}/content`,
          token,
        )

        if (cancelled) return

        const raw = response.content ?? ''
        const { body, frontmatter, meta } = stripFrontmatter(raw)
        frontmatterRef.current = frontmatter
        latestContentRef.current = body
        setContent(body)

        if (!initialDate && meta.date) {
          setDate(meta.date)
          latestDateRef.current = meta.date
        }
      } catch (error) {
        console.error('[NoteEditor] Failed to load content:', error)
        if (!cancelled && initialContent != null) {
          latestContentRef.current = initialContent
          setContent(initialContent)
        }
      }

      if (!cancelled) setLoaded(true)
    }

    void load()

    return () => {
      cancelled = true
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current)
    }
  }, [documentId, initialContent, initialDate])

  React.useEffect(() => {
    const handleOnline = () => {
      if (dirtyRef.current) void save()
    }

    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [save])

  const markMetaDirty = () => {
    dirtyRef.current = true
    metaDirtyRef.current = true
    setSaveStatus('idle')
    scheduleSave()
  }

  const handleTitleChange = (nextTitle: string) => {
    const sanitized = sanitizeTitle(nextTitle)
    setTitle(sanitized)
    latestTitleRef.current = sanitized
    onTitleChange?.(sanitized)
    markMetaDirty()
  }

  const handleContentChange = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
    const nextContent = event.target.value
    setContent(nextContent)
    latestContentRef.current = nextContent
    dirtyRef.current = true
    setSaveStatus('idle')
    scheduleSave()
  }

  const handleDateSelect = (selected: Date | undefined) => {
    const value = selected ? format(selected, 'yyyy-MM-dd') : ''
    setDate(value)
    latestDateRef.current = value
    setCalendarOpen(false)
    markMetaDirty()
  }

  const handleAddTag = () => {
    const tag = tagInput.trim()
    if (!tag || tags.includes(tag)) {
      setTagInput('')
      return
    }

    const nextTags = [...tags, tag]
    setTags(nextTags)
    latestTagsRef.current = nextTags
    setTagInput('')
    markMetaDirty()
  }

  const handleRemoveTag = (tag: string) => {
    const nextTags = tags.filter((entry) => entry !== tag)
    setTags(nextTags)
    latestTagsRef.current = nextTags
    markMetaDirty()
  }

  const handleTagKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      handleAddTag()
    }
    if (event.key === 'Backspace' && !tagInput && tags.length > 0) {
      handleRemoveTag(tags[tags.length - 1])
    }
  }

  const handlePropertyChange = (key: string, value: TypedProperty['value']) => {
    const current = properties[key]
    if (!current) return

    const nextProperties = { ...properties, [key]: { ...current, value } }
    setProperties(nextProperties)
    latestPropertiesRef.current = nextProperties
    markMetaDirty()
  }

  const handlePropertyRename = (oldKey: string, newKey: string) => {
    const trimmed = newKey.trim()
    if (!trimmed || (trimmed !== oldKey && trimmed in properties)) return

    const nextProperties: PropertyMap = {}
    for (const [key, value] of Object.entries(properties)) {
      nextProperties[key === oldKey ? trimmed : key] = value
    }

    setProperties(nextProperties)
    latestPropertiesRef.current = nextProperties
    markMetaDirty()
  }

  const handleAddProperty = (type: PropertyType) => {
    let key = 'property'
    let index = 1
    while (key in properties) key = `property ${index++}`

    const nextProperties = { ...properties, [key]: defaultValue(type) }
    setProperties(nextProperties)
    latestPropertiesRef.current = nextProperties
    markMetaDirty()
  }

  const handleRemoveProperty = (key: string) => {
    const nextProperties = { ...properties }
    delete nextProperties[key]
    setProperties(nextProperties)
    latestPropertiesRef.current = nextProperties
    markMetaDirty()
  }

  const handleSelectOptionsChange = (key: string, options: string[]) => {
    const current = properties[key]
    if (!current || current.type !== 'select') return

    const nextProperties = { ...properties, [key]: { ...current, options } }
    setProperties(nextProperties)
    latestPropertiesRef.current = nextProperties
    markMetaDirty()
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className={cn(
        'shrink-0 flex items-center gap-3 border-b border-border',
        embedded ? 'px-4 py-2' : 'px-5 py-4 bg-background',
      )}>
        {!embedded && (
          <>
            <button
              onClick={onBack ?? (() => {})}
              className="p-1 rounded transition-colors hover:bg-accent cursor-pointer text-foreground"
            >
              <ChevronLeft className="size-4" />
            </button>
            <div className="min-w-0 mr-auto text-sm">
              <div className="text-muted-foreground truncate">{backLabel ?? 'Back'}</div>
              <div className="font-medium truncate">{title || 'Untitled'}</div>
            </div>
          </>
        )}

        {embedded ? (
          <input
            type="text"
            value={title}
            onChange={(event) => handleTitleChange(event.target.value)}
            placeholder="Untitled"
            className="flex-1 min-w-0 text-sm font-medium text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/30"
          />
        ) : (
          <div className="text-[10px] text-muted-foreground ml-auto">
            {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
          </div>
        )}
      </div>

      <div className={cn(
        'flex-1 overflow-y-auto',
        embedded ? '' : 'bg-background px-6',
      )}>
        <div className={cn(
          embedded
            ? 'max-w-3xl mx-auto px-8 py-10'
            : 'max-w-4xl mx-auto px-20 py-12 bg-card rounded-2xl border border-border/40 shadow-sm mb-6 min-h-[calc(100%-1.5rem)]',
        )}>
          {!embedded && (
            <input
              type="text"
              value={title}
              onChange={(event) => handleTitleChange(event.target.value)}
              placeholder="Untitled"
              className="w-full text-2xl font-bold text-foreground bg-transparent border-none outline-none placeholder:text-muted-foreground/30 mb-4"
            />
          )}

          {!metaExpanded && (tags.length > 0 || date) && (
            <button
              onClick={() => setMetaExpanded(true)}
              className="flex items-center gap-2 mb-4 text-xs text-muted-foreground/50 hover:text-muted-foreground transition-colors cursor-pointer"
            >
              {date && <span className="bg-muted px-1.5 py-0.5 rounded text-[11px]">{date}</span>}
              {tags.length > 0 && <span className="bg-muted px-1.5 py-0.5 rounded text-[11px]">Tags {tags.length}</span>}
            </button>
          )}

          {!metaExpanded && !tags.length && !date && (
            <button
              onClick={() => setMetaExpanded(true)}
              className="flex items-center gap-1.5 mb-4 text-xs text-muted-foreground/30 hover:text-muted-foreground transition-colors cursor-pointer"
            >
              <Plus className="size-3" />
              Add metadata
            </button>
          )}

          {metaExpanded && (
            <div className="mb-6 space-y-0.5">
              <div className="flex items-center h-8">
                <div className="flex items-center gap-2 w-24 shrink-0">
                  <CalendarIcon className="size-3.5 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Date</span>
                </div>
                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                  <PopoverTrigger asChild>
                    <button
                      className={cn(
                        'text-sm h-7 transition-colors cursor-pointer px-1.5',
                        date ? 'text-foreground' : 'text-muted-foreground/40',
                      )}
                    >
                      {dateValue ? format(dateValue, 'PPP') : 'Pick a date'}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={dateValue}
                      onSelect={handleDateSelect}
                      defaultMonth={dateValue ?? new Date()}
                    />
                  </PopoverContent>
                </Popover>
                {date && (
                  <button
                    onClick={() => {
                      setDate('')
                      latestDateRef.current = ''
                      markMetaDirty()
                    }}
                    className="ml-1 text-muted-foreground/40 hover:text-muted-foreground cursor-pointer"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              <TagsRow
                tags={tags}
                tagInput={tagInput}
                onTagInputChange={setTagInput}
                onTagKeyDown={handleTagKeyDown}
                onAddTag={handleAddTag}
                onRemoveTag={handleRemoveTag}
              />

              {Object.entries(properties).map(([key, property]) => (
                <PropertyRow
                  key={key}
                  propKey={key}
                  property={property}
                  onValueChange={(value) => handlePropertyChange(key, value)}
                  onKeyRename={handlePropertyRename}
                  onRemove={() => handleRemoveProperty(key)}
                  onOptionsChange={
                    property.type === 'select'
                      ? (options) => handleSelectOptionsChange(key, options)
                      : undefined
                  }
                />
              ))}

              <AddPropertyButton onAdd={handleAddProperty} />

              <button
                onClick={() => setMetaExpanded(false)}
                className="flex items-center gap-1.5 h-7 text-sm text-muted-foreground/30 hover:text-muted-foreground transition-colors cursor-pointer"
              >
                <ChevronUp className="size-3.5" />
                <span>Hide metadata</span>
              </button>
            </div>
          )}

          {loaded ? (
            <textarea
              value={content}
              onChange={handleContentChange}
              onBlur={() => void save()}
              spellCheck={false}
              className="w-full min-h-[calc(100vh-280px)] resize-none bg-transparent border-none outline-none font-mono text-[14px] leading-6 text-foreground placeholder:text-muted-foreground/30"
              placeholder="Write markdown here..."
            />
          ) : (
            <div className="flex min-h-[240px] items-center justify-center">
              <span className="text-sm text-muted-foreground">Loading note...</span>
            </div>
          )}
        </div>
      </div>

      <div className={cn(
        'shrink-0 flex items-center justify-end py-1.5',
        embedded ? 'px-4 border-t border-border' : 'px-5 bg-background',
      )}>
        <span className="text-[10px] text-muted-foreground mr-3">
          {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? 'Saved' : ''}
        </span>
        <span className="text-[10px] text-muted-foreground tabular-nums">{wordCount} words</span>
      </div>
    </div>
  )
}
