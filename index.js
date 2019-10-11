const Router = require('./router')
const rrtypes = [
    'A',
    'AAAA',
    'CAA',
    'CNAME',
    'DS',
    'DNSKEY',
    'MX',
    'NS',
    'NSEC',
    'NSEC3',
    'RRSIG',
    'SOA',
    'TXT'
]

/**
 * Example of how router can be used in an application
 *  */
addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

function isInArray(value, array) {
  return array.indexOf(value) > -1;
}

async function getDNS(domain, rtype) {
    let records = []
    req = await fetch(`https://cloudflare-dns.com/dns-query?ct=application/dns-json&name=${domain}&type=${rtype}`, {
        headers: {
            'Accept': 'application/dns-json'
        }
    })

    if (req.status == 200) {
        req = await req.json()
        for (var val in req.Answer) {
            records.push(req.Answer[val]['data'])
        }
    }

    return records
}

async function handleTwilio(req) {
    let formData = await req.formData()

    let messageFrom = formData.get('MessageSid')
    let message_from = formData.get('From')
    let message_body = formData.get('Body')

    let data = message_body.trim().split(' ')
    let domain = ''
    let rtype = 'AAAA'

    let output = ''
    let ips = ''

    if (data.length > 1) {
        rtype = data[0].toUpperCase()
        domain = data[1].toLowerCase()
    } 
    else {
        domain = data[0].toLowerCase()
    }

    if (isInArray(rtype, rrtypes) == false) {
        output = `${rtype} is not supported at this time. Please try another record type (e.g AAAA ${domain})`
    }
    else {
        let d = await getDNS(domain, rtype)

        if (d.length > 0) {
            ips = d.join('\r\n')
        }
        else {
            ips = `We couldn't find any ${rtype} records for ${domain}`
        }

        output = `${ips}

=======
1.1.1.1 is a partnership between Cloudflare and APNIC`
    }

    return new Response(output, {
        headers: {
            'Content-Type': 'text/plain'
        }
    })
}

function handleTelegram(req) {
    return false    
}

async function handleRequest(request) {
    const r = new Router()

    // /incoming/*
    r.post('/incoming/telegram', req => handleTelegram(req)) // telegram
    r.post('/incoming/twilio', req => handleTwilio(req)) // twilio

    r.get('/', () => new Response('', {
        status: 302,
        headers: {
            'Location': 'https://cloudflare-dns.com'
        }
    }))

    const resp = await r.route(request)
    return resp
}
