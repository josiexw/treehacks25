# jetson

ssh into jetson: ssh -L 7860:localhost:7860 jetson@10.19.176.210
cd jetson-containers/
docker attach <spam tab>
python3 tree_demo16.py --camera 0 --resolution 640x480     ../../data/owl_image_encoder_patch32.engine

ctrl p ctrl q to detach properly

how to open docker container

jetson-containers run --workdir /opt/nanoowl $(autotag nanoowl)