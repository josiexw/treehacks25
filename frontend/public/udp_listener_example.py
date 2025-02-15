import socket

UDP_IP = "0.0.0.0"  # Listen on all available interfaces
UDP_PORT = 8888

sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
sock.bind((UDP_IP, UDP_PORT))

print(f"Listening for UDP broadcasts on port {UDP_PORT}...")

while True:
    data, addr = sock.recvfrom(1024)
    command = data.decode('utf-8')
    print(f"Received command: {command} from {addr}")
    # Handle the command here to control your RC car