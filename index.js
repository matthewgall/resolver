const router = require('./router')
const validator = require('validator');
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

addEventListener('fetch', event => {
    event.respondWith(handleRequest(event.request))
})

function isInArray(value, array) {
  return array.indexOf(value) > -1;
}

async function sendTelegram(token, chat_id, message) {
    let req = await fetch(`https://api.telegram.org/bot${token}/sendMessage?chat_id=${chat_id}&text=${message}`)

    if (req.status == 200) {
        return true
    }
    return false
}

async function sendEmail(meta, to, message) {
    let req = await fetch(`https://api.mailgun.net/v3/${meta['from']['domain']}/messages`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': meta['auth']
        },
        body: `from=${meta['from']['name']} <${meta['from']['address']}>&subject=${meta['subject']}&to=${to}&text=${message}`
    })
}

async function getDNS(domain, rtype) {
    let records = []
    let req = await fetch(
        `https://cloudflare-dns.com/dns-query?ct=application/dns-json&name=${domain}&type=${rtype}`, {
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

    let messageId = formData.get('MessageSid')
    let messageFrom = formData.get('From')
    let messageBody = formData.get('Body')

    let data = messageBody.trim().split(' ')
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

    if (validator.isFQDN(domain) == false) {
        return new Response(`${domain} does not appear to be a FQDN`)
    }

    if (isInArray(rtype, rrtypes) == false) {
        return new Response(`${rtype} is not supported at this time. Please try another record type (e.g AAAA ${domain})`)
    }

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

    return new Response(output, {
        headers: {
            'Content-Type': 'text/plain'
        }
    })
}

async function handleTelegram(req) {
    let secretsTelegram = await secrets.get('telegram')
    secretsTelegram = JSON.parse(secretsTelegram)

    let params = new URL(req.url).searchParams
    let botName = params.get('bot').toLowerCase()

    if (botName == null) {
        return new Response(`Unable to determine which bot is being used`, {
            status: 404,
            headers: {
                'Content-Type': 'text/plain'
            }
        })
    }

    let botToken = secretsTelegram[botName]
    let formData = await req.json()

    let messageId = formData['message']['chat']['id']
    let messageBody = formData['message']['text']

    let data = messageBody.trim().split(' ')
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


    if (isInArray(domain, ['/start', '/stop', '/help'])) {
        output = `Welcome to 1.1.1.1, a partnership between Cloudflare and APNIC

To get started, simply send the record type (default: AAAA), followed by a space and the hostname you'd like to lookup and I'll answer as quick as I can!`
    }

    if (validator.isFQDN(domain) == false) {
        output = `${domain} does not appear to be a FQDN`
        let t = await sendTelegram(botToken, messageId, output)
        return new Response(output)
    }

    if (isInArray(rtype, rrtypes) == false) {
        output = `${rtype} is not supported at this time. Please try another record type (e.g AAAA ${domain})`
        let t = await sendTelegram(botToken, messageId, output)
        return new Response(output)
    }

    if (isInArray(rtype, rrtypes) == false) {
        output = `${rtype} is not supported at this time. Please try another record type (e.g AAAA ${domain})`
        let t = await sendTelegram(botToken, messageId, output)
        return new Response(output)
    }

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

    let t = await sendTelegram(botToken, messageId, output)
    return new Response(output, {
        headers: {
            'Content-Type': 'text/plain'
        }
    })
}

async function handleEmail(req) {
    let secretsEmail = await secrets.get('email')
    secretsEmail = JSON.parse(secretsEmail)

    let formData = await req.formData()
    let messageFrom = formData.get('sender')
    let messageBody = formData.get('stripped-text')

    let data = messageBody.trim().split(' ')
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

    if (validator.isFQDN(domain) == false) {
        output = `${domain} does not appear to be a FQDN`
        let t = await sendEmail(secretsEmail, messageFrom, output)
        return new Response(output)
    }

    if (isInArray(rtype, rrtypes) == false) {
        output = `${rtype} is not supported at this time. Please try another record type (e.g AAAA ${domain})`
        let t = await sendEmail(secretsEmail, messageFrom, output)
        return new Response(output)
    }

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

    let t = await sendEmail(secretsEmail, messageFrom, output)
    return new Response(output, {
        headers: {
            'Content-Type': 'text/plain'
        }
    })

}

async function handleRequest(request) {
    const r = new router()

    // /incoming/*
    r.post('/incoming/email', req => handleEmail(req)) // email
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
