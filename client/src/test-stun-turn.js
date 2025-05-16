function testStunTurnConfig() {
  console.log("Testing STUN and TURN server configuration")

  console.log("Environment variables:")
  console.log("VITE_STUN_URL:", import.meta.env.VITE_STUN_URL)
  console.log("VITE_TURN_URL_1:", import.meta.env.VITE_TURN_URL_1)
  console.log("VITE_TURN_URL_2:", import.meta.env.VITE_TURN_URL_2)
  console.log("VITE_TURN_URL_3:", import.meta.env.VITE_TURN_URL_3)
  console.log("VITE_TURN_URL_4:", import.meta.env.VITE_TURN_URL_4)
  console.log("VITE_TURN_USERNAME:", import.meta.env.VITE_TURN_USERNAME)
  console.log("VITE_TURN_CREDENTIAL:", import.meta.env.VITE_TURN_CREDENTIAL)

  const config = {
    iceServers: [
      {
        urls: [import.meta.env.VITE_STUN_URL || "stun:stun.l.google.com:19302"],
      },
      {
        urls: [
          import.meta.env.VITE_TURN_URL_1 || "turn:openrelay.metered.ca:80",
          import.meta.env.VITE_TURN_URL_2 || "turn:openrelay.metered.ca:443",
          import.meta.env.VITE_TURN_URL_3 || "turn:openrelay.metered.ca:443?transport=tcp",
        ],
        username: import.meta.env.VITE_TURN_USERNAME || "openrelayproject",
        credential: import.meta.env.VITE_TURN_CREDENTIAL || "openrelayproject",
      },
      {
        urls: import.meta.env.VITE_TURN_URL_4 || "turns:openrelay.metered.ca:443?transport=tcp",
        username: import.meta.env.VITE_TURN_USERNAME || "openrelayproject",
        credential: import.meta.env.VITE_TURN_CREDENTIAL || "openrelayproject",
      },
    ],
    iceTransportPolicy: "all",
    iceCandidatePoolSize: 10,
  }

  console.log("RTCPeerConnection config:", JSON.stringify(config, null, 2))

  const pc = new RTCPeerConnection(config)

  pc.onicecandidate = (event) => {
    if (event.candidate) {
      console.log("ICE candidate:", event.candidate.candidate)

      const candidateStr = event.candidate.candidate
      if (candidateStr.includes("relay")) {
        console.log("%cTURN server being used! ✅", "color: green; font-weight: bold", candidateStr)
      } else if (candidateStr.includes("srflx")) {
        console.log("%cSTUN server being used! ✅", "color: green; font-weight: bold", candidateStr)
      }
    }
  }

  pc.onicegatheringstatechange = () => {
    console.log("ICE gathering state:", pc.iceGatheringState)

    if (pc.iceGatheringState === "complete") {
      const sdp = pc.localDescription.sdp

      const hostCount = (sdp.match(/typ host/g) || []).length
      const srflxCount = (sdp.match(/typ srflx/g) || []).length
      const relayCount = (sdp.match(/typ relay/g) || []).length

      console.log("\n=== ICE Candidates Summary ===")
      console.log(`Local candidates (typ host): ${hostCount}`)
      console.log(`STUN candidates (typ srflx): ${srflxCount}`)
      console.log(`TURN candidates (typ relay): ${relayCount}`)

      if (srflxCount > 0) {
        console.log("%cSTUN server is working correctly! ✅", "color: green; font-weight: bold")
      } else {
        console.log("%cNo STUN candidates found. STUN server may not be working. ❌", "color: red; font-weight: bold")
      }

      if (relayCount > 0) {
        console.log("%cTURN server is working correctly! ✅", "color: green; font-weight: bold")
      } else {
        console.log("%cNo TURN candidates found. TURN server may not be working. ❌", "color: red; font-weight: bold")
      }

      console.log(
        "\nNote: Even if both STUN and TURN are working, the actual server used during a connection depends on network conditions.",
      )
    }
  }

  pc.oniceconnectionstatechange = () => {
    console.log("ICE connection state:", pc.iceConnectionState)
  }

  const dc = pc.createDataChannel("test")

  pc.createOffer()
    .then((offer) => pc.setLocalDescription(offer))
    .then(() => {
      console.log("Local description set, ICE gathering started")
    })
    .catch((err) => {
      console.error("Error creating offer:", err)
    })

  return pc
}

window.testStunTurnConfig = testStunTurnConfig

console.log("STUN/TURN test script loaded. Run window.testStunTurnConfig() in the console to test.")
