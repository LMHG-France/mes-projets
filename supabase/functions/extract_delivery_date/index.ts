// supabase/functions/extract_delivery_date/index.ts

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function detectCarrierSlug(url: string): string | null {
  if (url.includes('chronopost.fr'))                             return 'chronopost-france'
  if (url.includes('laposte.fr'))                                return 'colissimo'
  if (url.includes('colissimo.fr'))                              return 'colissimo'
  if (url.includes('dpd.fr') || url.includes('dpd.com'))        return 'dpd-fr'
  if (url.includes('ups.com'))                                   return 'ups'
  if (url.includes('mydhl.express') || url.includes('dhl.express'))  return 'dhl-express'
  if (url.includes('dhl.com') || url.includes('dhl.fr'))              return 'dhl-express'
  if (url.includes('fedex.com'))                                 return 'fedex'
  if (url.includes('colis-prive.com'))                           return 'colis-prive'
  if (url.includes('gls-group.eu') || url.includes('gls-fr'))   return 'gls-fr'
  if (url.includes('amazon.fr') || url.includes('amzn'))        return 'amazon'
  if (url.includes('tnt.com'))                                   return 'tnt-fr'
  if (url.includes('geodis.com'))                                return 'geodis'
  if (url.includes('mondialrelay.fr') || url.includes('mondialrelay.com')) return 'mondial-relay'
  if (url.includes('relaiscolisrs.fr') || url.includes('relaiscolis.com')) return 'relais-colis'
  if (url.includes('bpost.be'))                                  return 'bpost'
  if (url.includes('postnl.nl') || url.includes('postnl.com'))  return 'postnl'
  if (url.includes('hermes.com') || url.includes('myhermes.co.uk')) return 'hermes-uk'
  if (url.includes('royalmail.com'))                             return 'royal-mail'
  if (url.includes('correos.es'))                                return 'correos-es'
  return null
}

function extractTrackingNumber(url: string, slug: string): string | null {
  try {
    // Extraire d'abord depuis le fragment hash (#/results?id=XXXX)
    const hashIndex = url.indexOf('#')
    if (hashIndex !== -1) {
      const hash = url.slice(hashIndex)
      const hashId = hash.match(/[?&]id=([^&\s]+)/)
      if (hashId) return hashId[1]
    }

    const u = new URL(url)
    if (slug === 'chronopost-france') {
      const lt = u.searchParams.get('listeNumerosLT')  // ← variante avec 's'
             || u.searchParams.get('listeNumeroLT')
             || u.searchParams.get('listeNumero')
             || u.searchParams.get('numero')
             || u.searchParams.get('id')
      if (lt) return lt.split(',')[0].trim()
      const seg = u.pathname.split('/').filter(Boolean).pop()
      if (seg && /^[A-Z0-9]{8,}$/i.test(seg)) return seg
    }
    if (slug === 'colissimo') {
      const code = u.searchParams.get('code') || u.searchParams.get('colisID')
      if (code) return code
    }
    if (slug === 'dpd-fr') {
      const p = u.searchParams.get('parcelNr') || u.searchParams.get('reference')
      if (p) return p
    }
    for (const [, v] of u.searchParams) {
      if (/^[A-Z0-9]{8,30}$/i.test(v.trim())) return v.trim()
    }
    const segs = u.pathname.split('/').filter(Boolean)
    for (const s of segs.reverse()) {
      if (/^[A-Z0-9]{8,30}$/i.test(s)) return s
    }
    return null
  } catch {
    return null
  }
}

function parseDate(raw: any): string | null {
  if (!raw) return null
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    const val = raw.datetime || raw.estimated_delivery_date || raw.latest || raw.earliest
    return val ? parseDate(val) : null
  }
  const s = String(raw).trim()
  const iso = s.match(/(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const dmy = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/)
  if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,'0')}-${dmy[1].padStart(2,'0')}`
  return null
}

function detectDeliveryType(slug: string, tag: string, subtag: string): string {
  const pickupOnlyCarriers = ['mondial-relay', 'relais-colis', 'pickup']
  if (pickupOnlyCarriers.includes(slug)) return 'pickup'
  if (tag === 'AvailableForPickup') return 'pickup'
  const s = (subtag || '').toLowerCase()
  if (s.includes('pickup') || s.includes('relais') || s.includes('locker') || s.includes('retrait')) return 'pickup'
  return 'home'
}

// Quand AfterShip passe en "Delivered" (y compris après récupération en point relais)
// → on met automatiquement en "delivered" dans l'app
function tagToStatus(tag: string, subtag: string): string | null {
  if (tag === 'Delivered')           return 'delivered'
  if (tag === 'AvailableForPickup')  return 'available'
  if (subtag && subtag.toLowerCase().includes('pickup'))  return 'available'
  if (subtag && subtag.toLowerCase().includes('retrait')) return 'available'
  return null
}

async function fetchAfterShip(trackingNumber: string, slug: string, apiKey: string): Promise<{delivery_date: string|null, delivery_status: string|null, delivery_type: string|null}> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'as-api-key': apiKey,
  }

  try {
    const BASE = 'https://api.aftership.com/tracking/2023-10'

    const createBody: any = { tracking_number: trackingNumber }
    if (slug && slug !== 'auto') createBody.slug = slug
    const createRes = await fetch(`${BASE}/trackings`, {
      method: 'POST',
      headers,
      body: JSON.stringify(createBody)
    })

    const createData = await createRes.json()
    console.log(`AfterShip create: ${createRes.status} data=${JSON.stringify(createData?.data).substring(0, 3000)}`)

    let tracking: any = null
    // Si rate limit (429), attendre et réessayer une fois
    if (createRes.status === 429) {
      console.log('Rate limit AfterShip (429), attente 2s...')
      await new Promise(r => setTimeout(r, 2000))
      const retryRes = await fetch(`${BASE}/trackings`, {
        method: 'POST', headers, body: JSON.stringify(createBody)
      })
      const retryData = await retryRes.json()
      if (retryRes.ok || retryData?.meta?.code === 4003) {
        return fetchAfterShip(trackingNumber, slug, apiKey) // relancer proprement
      }
    }

    const isNew      = createRes.status === 201
    const isExisting = createRes.status === 409 || createData?.meta?.code === 4003

    if (isNew) {
      // AfterShip vient de créer le tracking → les données carrier ne sont pas encore chargées
      // On attend 2.5s puis on re-fetch pour avoir les vraies infos
      const newId = createData?.data?.id
      if (newId) {
        console.log(`Nouveau tracking créé (${newId}), attente 2.5s avant re-fetch...`)
        await new Promise(r => setTimeout(r, 2500))
        const retryRes = await fetch(`${BASE}/trackings/${newId}`, { headers })
        const retryData = await retryRes.json()
        console.log(`Re-fetch après création: ${retryRes.status} data=${JSON.stringify(retryData?.data).substring(0, 500)}`)
        if (retryRes.ok) tracking = retryData?.data
      }
      if (!tracking) tracking = createData?.data
    } else if (isExisting) {
      const trackingId   = createData?.data?.id
      const detectedSlug = createData?.data?.slug || slug
      console.log(`Tracking existant id=${trackingId} slug=${detectedSlug}`)

      if (trackingId) {
        const getRes = await fetch(`${BASE}/trackings/${trackingId}`, { headers })
        const getData = await getRes.json()
        console.log(`AfterShip get by id: ${getRes.status} data=${JSON.stringify(getData?.data).substring(0, 3000)}`)
        if (getRes.ok) tracking = getData?.data
      }

      if (!tracking) {
        const getRes = await fetch(`${BASE}/trackings/${detectedSlug}/${trackingNumber}`, { headers })
        const getData = await getRes.json()
        console.log(`AfterShip get by slug: ${getRes.status} data=${JSON.stringify(getData?.data).substring(0, 3000)}`)
        if (getRes.ok) tracking = getData?.data
      }

      // Si toujours rien (404 sur le slug), chercher dans tous les trackings par numéro
      if (!tracking) {
        console.log(`Tentative recherche par numéro sans slug...`)
        const searchRes = await fetch(`${BASE}/trackings?tracking_numbers=${trackingNumber}`, { headers })
        const searchData = await searchRes.json()
        console.log(`AfterShip search: ${searchRes.status} count=${searchData?.data?.trackings?.length}`)
        if (searchRes.ok && searchData?.data?.trackings?.length > 0) {
          tracking = searchData.data.trackings[0]
        }
      }
    } else {
      console.error('AfterShip error:', JSON.stringify(createData).substring(0, 400))
      return { delivery_date: null, delivery_status: null, delivery_type: null }
    }

    if (!tracking) return { delivery_date: null, delivery_status: null, delivery_type: null }

    console.log(`DATE FIELDS: latest=${JSON.stringify(tracking.latest_estimated_delivery)} first=${JSON.stringify(tracking.first_estimated_delivery)} aftership=${JSON.stringify(tracking.aftership_estimated_delivery_date)} courier=${JSON.stringify(tracking.courier_estimated_delivery_date)}`)

    const candidates = [
      tracking.latest_estimated_delivery,
      tracking.first_estimated_delivery,
      tracking.aftership_estimated_delivery_date,
      tracking.courier_estimated_delivery_date,
      tracking.custom_estimated_delivery_date,
      tracking.order_promised_delivery_date,
      tracking.shipment_delivery_date,
      tracking.expected_delivery,
      tracking.estimated_delivery_date,
      tracking.delivery_date,
    ]

    let deliveryDate: string | null = null
    for (const c of candidates) {
      const d = parseDate(c)
      if (d) { deliveryDate = d; break }
    }

    const tag    = tracking.tag    || ''
    const subtag = tracking.subtag || ''
    console.log(`tag=${tag} subtag=${subtag} date=${deliveryDate}`)

    // Déterminer le type en premier (nécessaire pour tagToStatus)
    const deliveryType   = detectDeliveryType(slug, tag, subtag)
    const deliveryStatus = tagToStatus(tag, subtag)

    let finalDate = deliveryDate
    if (!finalDate && deliveryStatus === 'available') {
      finalDate = new Date().toISOString().split('T')[0]
    }

    return { delivery_date: finalDate, delivery_status: deliveryStatus, delivery_type: deliveryType }
  } catch (e) {
    console.error('AfterShip error:', e)
    return { delivery_date: null, delivery_status: null, delivery_type: null }
  }
}


// Scrape la date directement depuis la page Chronopost en fallback
async function scrapeChronopostDate(trackingNumber: string): Promise<string | null> {
  try {
    const url = `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${trackingNumber}&langue=fr`
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'fr-FR,fr;q=0.9',
      }
    })
    const html = await res.text()

    // Chercher patterns de date dans le HTML
    // Ex: "Livraison prévue le 10/03/2026" ou "10 mars 2026" ou "2026-03-10"
    const patterns = [
      /livraison pr[eé]vue.*?(\d{2}\/\d{2}\/\d{4})/i,
      /livraison.*?(\d{1,2})\s+(janvier|février|mars|avril|mai|juin|juillet|août|septembre|octobre|novembre|décembre)\s+(\d{4})/i,
      /(\d{4}-\d{2}-\d{2})/,
      /(\d{2})\/(\d{2})\/(\d{4})/,
    ]

    const months: Record<string,string> = {
      'janvier':'01','février':'02','mars':'03','avril':'04','mai':'05','juin':'06',
      'juillet':'07','août':'08','septembre':'09','octobre':'10','novembre':'11','décembre':'12'
    }

    for (const pattern of patterns) {
      const m = html.match(pattern)
      if (m) {
        if (m[2] && months[m[2].toLowerCase()]) {
          // Format "10 mars 2026"
          return `${m[3]}-${months[m[2].toLowerCase()]}-${m[1].padStart(2,'0')}`
        }
        if (m[1]?.includes('-')) return m[1] // ISO
        if (m[3]?.length === 4) return `${m[3]}-${m[2]}-${m[1]}` // dd/mm/yyyy
      }
    }
    console.log('Chronopost scrape: aucune date trouvée dans le HTML')
    return null
  } catch(e) {
    console.error('Chronopost scrape error:', e)
    return null
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { order_id, tracking_url } = await req.json()

    if (!tracking_url) {
      return new Response(JSON.stringify({ error: 'tracking_url requis' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      })
    }

    const aftershipKey = Deno.env.get('AFTERSHIP_API_KEY')
    if (!aftershipKey) {
      return new Response(JSON.stringify({
        error: 'AFTERSHIP_API_KEY manquant dans les secrets Supabase',
        delivery_date: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      })
    }

    // Détecter si c'est une URL ou un numéro de suivi brut
    const isUrl = tracking_url.startsWith('http')
    let slug: string | null = null
    let trackingNumber: string | null = null

    if (isUrl) {
      slug = detectCarrierSlug(tracking_url)
      trackingNumber = slug ? extractTrackingNumber(tracking_url, slug) : null
    } else {
      trackingNumber = tracking_url.trim()
      // Essayer de détecter le carrier depuis le format du numéro
      if (/^\d{10}$/.test(trackingNumber)) {
        slug = 'dhl-express'  // DHL Express : 10 chiffres
      } else if (/^[A-Z]{2}\d{9}[A-Z]{2}$/.test(trackingNumber)) {
        slug = 'chronopost-france'  // Format Chronopost/La Poste
      } else {
        slug = 'auto'
      }
      console.log(`Numéro brut détecté: ${trackingNumber} → slug=${slug}`)
    }

    console.log(`[START] isUrl=${isUrl} slug=${slug} tracking=${trackingNumber}`)

    if (!trackingNumber) {
      return new Response(JSON.stringify({
        error: 'Numéro de suivi invalide',
        delivery_date: null
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    let { delivery_date, delivery_status, delivery_type } = await fetchAfterShip(trackingNumber, slug, aftershipKey)

    // Fallback : scraper la date directement depuis Chronopost si AfterShip n'en a pas
    if (!delivery_date && slug === 'chronopost-france') {
      console.log('AfterShip sans date pour Chronopost → tentative scraping direct')
      delivery_date = await scrapeChronopostDate(trackingNumber)
      if (delivery_date) console.log(`Date trouvée par scraping: ${delivery_date}`)
    }

    // Mise à jour en base
    if (order_id) {
      const upd: any = {
        // ── FIX : toujours mettre à jour delivery_last_checked_at
        //    même si rien n'a changé → l'indicateur dans l'app reste vert
        delivery_last_checked_at: new Date().toISOString(),
        delivery_date_updated_at: new Date().toISOString(),
      }
      if (delivery_date)   upd.expected_delivery_date = delivery_date
      if (delivery_status) upd.delivery_status        = delivery_status
      if (delivery_type)   upd.delivery_type          = delivery_type

      console.log(`DB update attempt: order_id=${order_id} upd=${JSON.stringify(upd)}`)
      const { error, data: updData } = await supabaseClient
        .from('orders').update(upd).eq('id', order_id).neq('delivery_status', 'collected').select()
      if (error) console.error('DB update error:', JSON.stringify(error))
      else console.log(`DB update success: rows=${JSON.stringify(updData?.length)} data=${JSON.stringify(updData)}`)
    }

    console.log(`[END] date=${delivery_date} status=${delivery_status}`)

    return new Response(JSON.stringify({ delivery_date, delivery_status, delivery_type, carrier: slug, tracking_number: trackingNumber }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return new Response(JSON.stringify({ error: String(error), delivery_date: null }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})