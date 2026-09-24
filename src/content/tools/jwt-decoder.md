---
title: "JWT Decoder"
description: "Decode a JSON Web Token's header and payload in your browser to inspect its claims, expiry, and signing algorithm."
category: developer
icon: "jwt-decoder"
tags: [jwt, token, auth]
status: published
featured: false
publishedAt: 2026-09-24
component: "jwt-decoder/JwtDecoder"
localizations:
  ko:
    title: "JWT 디코더"
    description: "JSON 웹 토큰의 헤더와 페이로드를 브라우저에서 디코딩하여 클레임, 만료 시각, 서명 알고리즘을 확인합니다."
---

## What this is

A JSON Web Token is a string that carries sign-in information between a browser and a server. It looks like random characters, but it is really three parts joined by dots: a header, a payload, and a signature. The first two parts are only encoded, not encrypted, so anyone holding the token can read what is inside.

This tool splits a token apart and shows you the header and payload as readable text. Everything happens in your browser, so the token you paste never leaves your machine.

## Where this is useful

You are debugging a login flow and want to see which user id and roles the server actually put into the token.

A request keeps returning "unauthorized" and you need to check whether the token has already expired.

You are comparing two environments and want to confirm both issuers and audiences match what your config expects.

You are teaching someone how sign-in tokens work and want to show the structure instead of describing it.

You received a token from a partner service and need to know which signing algorithm it uses before wiring up verification.

## How to use this tool

Paste the full token into the input box. Include all three parts and both dots.

The header and payload appear as formatted text below. Copy either one with the copy button next to it.

Check the summary cards for the signing algorithm and the expiry status. If the token carries an expiry time, you will see whether it is still valid and how much time is left.

If the token is malformed, a short message tells you which part failed to decode.

## Frequently asked questions

**Is my token sent anywhere?**
No. The decoding runs entirely in your browser using built in functions. Nothing is uploaded, logged, or stored. You can disconnect from the network and the tool still works.

**Does this check whether the signature is valid?**
No. Verifying a signature requires the secret or public key that signed the token, and that key should stay on your server. This tool reads the parts that are meant to be readable and leaves verification to your backend.

**Why can I read the payload without a password?**
The payload is encoded with base64url, which is a transport format rather than a security measure. The signature is what stops someone from changing the contents. For that reason you should never place passwords or private data inside a token payload.

**What do claims like iat, exp, and sub mean?**
They are standard short names. The iat claim is when the token was issued, exp is when it stops being accepted, and sub identifies the subject, usually the user. The tool shows readable dates next to the time based claims.
