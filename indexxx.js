const Modbus = require("jsmodbus")
const net = require("net")
const socket = new net.Socket()
const client = new Modbus.client.TCP(socket, 1)
const options = {
    host: "192.168.127.254",
    port: 502,
}

// let mqtt = require("mqtt")
// let mqtt_client = mqtt.connect("mqtt:localhost:1883")

let topik = "andon-wcb"

// let message = '1;0';

let successCount = 0
let errorCount = 0
let reconnectCount = 0
let closedOnPurpose = false
let firstTime = true
let isConnected = true

var objDO = {
    value: null,
    Validation() {
        // console.log(`DO : ${this.nilai}`);
        // let message = `1:${this.nilai}`
        // mqtt_client.publish(topik, message);
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        this.value = value
        this.Validation()
    },
}

var objDI = {
    value: null,
    Validation() {
        // console.log(`DI : ${this.nilai}`);
        // let message = `1:${this.nilai}`
        // mqtt_client.publish(topik, message);
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        this.value = value
        this.Validation()
    },
}

var objDI_0 = {
    value: 0,
    Validation() {
        console.log(`DI #0 : ${this.nilai}`)
        var param = this.nilai == 0 ? false : true
        client
            .writeSingleCoil(0, param)
            .then(function (resp) {
                console.log("OK")
            })
            .catch(function () {
                console.error(arguments)
            })

        // client.writeSingleCoil(0)
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        this.value = value
        this.Validation()
    },
}

var objDO_0 = {
    value: 0,
    Validation() {
        console.log(`DO #0 : ${this.nilai}`)

        let message = `2:${this.nilai}`
        console.log("MQTT Send : ", message)
        mqtt_client.publish(topik, message)
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        this.value = value
        this.Validation()
    },
}

var objDO_1 = {
    value: 0,
    Validation() {
        console.log(`DO #1 : ${this.nilai}`)
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        this.value = value
        this.Validation()
    },
}

var objDO_2 = {
    value: 0,
    Validation() {
        console.log(`DO #2 : ${this.nilai}`)
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        this.value = value
        this.Validation()
    },
}

var objDO_3 = {
    value: 0,
    Validation() {
        console.log(`DO #3 : ${this.nilai}`)
    },
    get nilai() {
        return this.value
    },
    set nilai(value) {
        this.value = value
        this.Validation()
    },
}

const start2 = async function () {
    client.readDiscreteInputs(0, 7).then(
        function (resp) {
            var result = JSON.parse(JSON.stringify(resp))
            var bytes_DI = JSON.parse(JSON.stringify(result.response._body._discrete))
            if (objDI.nilai != parseInt(bytes_DI.data)) {
                objDI.nilai = parseInt(bytes_DI.data)
                objDI_0.nilai = bytes_DI.data[0]
            }
        },
        function (err) {
            console.error(err)
            errorCount += 1
            isConnected = false
            console.log(
                "Success",
                successCount,
                "Errors",
                errorCount,
                "Reconnect",
                reconnectCount
            )
            console.log("Request finished UNsuccessfull.")
        }
    )
}

const start = async function () {
    client.readCoils(0, 7).then(
        function (resp) {
            // console.log(resp);
            var result = JSON.parse(JSON.stringify(resp))
            var bytes = JSON.parse(JSON.stringify(result.response._body._coils))
            var bytes2 = JSON.parse(
                JSON.stringify(result.response._body._valuesAsArray)
            )
            // console.log("Nilai : ", result.response)
            // objD0.nilai = parseInt(bytes.data);
            // console.log("Coils: ", bytes)

            if (objDO.nilai != parseInt(bytes.data)) {
                objDO.nilai = parseInt(bytes.data)
                objDO_0.nilai = bytes2[0]
                objDO_1.nilai = bytes2[1]
                objDO_2.nilai = bytes2[2]
                objDO_3.nilai = bytes2[3]
            }
        },
        function (err) {
            console.error(err)
            errorCount += 1
            isConnected = false
            console.log(
                "Success",
                successCount,
                "Errors",
                errorCount,
                "Reconnect",
                reconnectCount
            )
            console.log("Request finished UNsuccessfull.")
        }
    )
}

socket.on("connect", function () {
    console.log("client connected....")

    if (firstTime) {
        firstTime = false
    } else {
        reconnectCount += 1
    }

    var sekarang = Date.now()
    setInterval(function () {
        var delta = Date.now() - sekarang // milliseconds elapsed since start
        // console.log(Math.floor(delta / 1000)); // in seconds
        // console.log(new Date().toUTCString());
        // start();
        start()
        start2()
    }, 50) // update about every seco
})

const shutdown = function () {
    closedOnPurpose = true
    socket.close()
}

process.on("SIGTERM", shutdown)
process.on("SIGINT", shutdown)

socket.on("close", async function () {
    console.log("Client closed, stopping interval.")
    isConnected = false

    if (!closedOnPurpose) {
        await socket.connect(options)
    }
})

socket.on("error", function (err) {
    console.log("Client Error", err)
})

socket.connect(options)