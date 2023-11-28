import ReverseString from "./utils/ReverseString.js"
import Split2Chr from "./utils/Split2Chr.js";
import String2Hex from "./utils/String2Hex.js";
import Modbus from 'jsmodbus'
import net from 'net'

let IpAddress = process.argv[2] // 192.168.7.101
let StationNO = process.argv[3] // 1
let PortNo = process.argv[4] // 502
let BarcodeNo = process.argv[5]
let closedOnPurpose
let D0 = 4096;

const socket = new net.Socket()
const client = new Modbus.client.TCP(socket, 1)
const options = {
    host: IpAddress,
    port: parseInt(PortNo),
    'autoReconnect': false,
    'logEnabled': true
}

const shutdown = function () {
    closedOnPurpose = true
    socketModbus.close()
}



function Div2Chr(_string) {
    const result = _string.match(/.{1,2}/g)
    return result
}

const WritePLCData = async function (_address, _value, _objectType, _length) {
    let address = parseInt(D0) + parseInt(_address)
    client.writeSingleRegister(address, parseInt(_value), 0)
        .then(function (resp) { }).catch(function () {
            console.error(arguments)
        })
}


async function tulis(_nilai) {
    let _reverse_string = ReverseString(_nilai)
    console.log("Barcode:", _reverse_string)
    let _arrays = Div2Chr(_nilai)
    let _barcodeAddress = 100
    for (var i = 0; i < _arrays.length; i++) {
        let _reverse_string = ReverseString(_arrays[i])
        let _string_to_hex = String2Hex(_reverse_string)
        let _value = parseInt(_string_to_hex, 16)
        console.log(_reverse_string)
        console.log(_value)
        WritePLCData(_barcodeAddress, _value)
        _barcodeAddress = _barcodeAddress + 1
    }
}


// process.on('SIGTERM', shutdown)
// process.on('SIGINT', shutdown)

socket.on('error', function (err) {
    console.log('Client Error', err)
})

socket.on('connect', function () {
    console.log('client connected.')
    WritePLCData(140, parseInt(BarcodeNo))
    // tulis(BarcodeNo)

})

socket.connect(options)