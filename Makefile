################################################################################
# deepstream-viize — Makefile
################################################################################

# Set CUDA_VER according to platform:
#   Jetson: 11.4
#   x86:    11.8
CUDA_VER ?= 11.8

APP     := deepstream-test5-analytics
CC      := gcc
CXX     := g++

SRCS    := deepstream_test5_app_main.c \
           deepstream_nvdsanalytics_meta.cpp

OBJS    := $(SRCS:.c=.o)
OBJS    := $(OBJS:.cpp=.o)

DS_SDK_ROOT ?= /opt/nvidia/deepstream/deepstream

CFLAGS  := -I$(DS_SDK_ROOT)/sources/includes \
           -Iincludes \
           $(shell pkg-config --cflags gstreamer-1.0 glib-2.0)

LDFLAGS := $(shell pkg-config --libs gstreamer-1.0 glib-2.0) \
           -L$(DS_SDK_ROOT)/lib \
           -lnvdsgst_meta \
           -lnvds_meta \
           -lnvds_msgbroker \
           -lcuda \
           -Wl,-rpath,$(DS_SDK_ROOT)/lib

all: $(APP)

$(APP): $(OBJS)
	$(CXX) -o $@ $^ $(LDFLAGS)

%.o: %.c
	$(CC) -c -o $@ $< $(CFLAGS)

%.o: %.cpp
	$(CXX) -c -o $@ $< $(CFLAGS)

clean:
	rm -f $(OBJS) $(APP)

.PHONY: all clean
